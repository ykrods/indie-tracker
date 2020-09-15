import os

from collections import OrderedDict
from datetime import datetime, timezone
from uuid import uuid4

from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import LiteralScalarString

from .base_git_repository import BaseGitRepository


yaml = YAML()


class update_yaml:
    """Context manager to Handle yaml file overwriting"""

    def __init__(self, fpath):
        self.fpath = fpath

    def __enter__(self):
        self.f = open(self.fpath, 'r+b')
        self.data = yaml.load(self.f)

        return self

    def __exit__(self, *exc):
        self.f.seek(0)

        yaml.dump(self.data, self.f)
        self.f.truncate()
        self.f.close()


class IssueRepository(BaseGitRepository):
    def relpath(self, uid):
        """ Relative path to file"""
        return os.path.join('issues', uid[:2], uid[2:] + '.yaml')

    def id_from_path(self, path):
        return path.lstrip('issues/').rstrip('.yaml').replace('/', '')

    def changelog_summaries(self, repo, commitid):
        """
        Return last commit info (commit id, object sha, created or deleted)
        per files
        """
        objs = OrderedDict()  # dict to remove duplicates

        exclude = [commitid.encode('utf-8')] if commitid else []

        for entry in repo.get_walker(paths=[b'issues'],
                                     reverse=True,
                                     exclude=exclude):
            for change in entry.changes():

                if change.type in ['add', 'modify']:
                    path = change.new.path.decode('utf-8')
                    objs[path] = {
                        'type': 'issue',
                        'commit': entry.commit.id.decode('utf-8'),
                        'sha': change.new.sha
                    }
                    objs.move_to_end(path)

                if change.type == 'delete':
                    path = change.old.path.decode('utf-8')
                    objs[path] = {
                        'type': 'issue_deleted',
                        'commit': entry.commit.id.decode('utf-8'),
                        'id': self.id_from_path(path)
                    }
                    objs.move_to_end(path)

        return objs.values()

    async def changes(self, commitid):
        """ get issues changes from given commit id

        * XXX: Asynchronous Generator is not effecive in current..
        """

        with self.repo() as r:
            if not self.head(r):
                return  # raise StopIteration

            for change in self.changelog_summaries(r, commitid):
                if sha := change.pop('sha', None):
                    change['data'] = yaml.load(
                        r.object_store[sha].data.decode('utf-8')
                    )
                yield change

    def create(self, data):
        now = datetime.now(tz=timezone.utc)
        issue = dict(
            data,
            id=str(uuid4()),
            body=LiteralScalarString(data['body']),
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
            comments=[]
        )

        relpath = self.relpath(issue['id'])
        fullpath = os.path.join(self.repo_path, relpath)

        os.makedirs(os.path.dirname(fullpath), exist_ok=True)

        yaml = YAML()
        with open(fullpath, 'wb') as f:
            yaml.dump(issue, f)

        commit_id = self.do_commit([relpath])

        return issue, commit_id

    def update(self, issue_id, data):
        relpath = self.relpath(issue_id)
        fullpath = os.path.join(self.repo_path, relpath)

        now = datetime.now(tz=timezone.utc)

        with update_yaml(fullpath) as y:
            issue = dict(y.data, **data)
            issue['body'] = LiteralScalarString(issue['body'])
            issue['updated_at'] = now.isoformat()
            y.data = issue

        commit_id = self.do_commit([relpath])

        return issue, commit_id

    def delete(self, issue_id):
        relpath = self.relpath(issue_id)
        fullpath = os.path.join(self.repo_path, relpath)

        os.unlink(fullpath)

        commit_id = self.do_commit([relpath])

        return commit_id

    def add_comment(self, issue_id, data):
        relpath = self.relpath(issue_id)
        fullpath = os.path.join(self.repo_path, relpath)

        comment = dict(
            data,
            id=str(uuid4()),
            body=LiteralScalarString(data['body'])
        )

        now = datetime.now(tz=timezone.utc)

        with update_yaml(fullpath) as y:
            issue = y.data
            if 'comments' not in issue:
                issue['comments'] = []
            issue['comments'].append(comment)
            issue['updated_at'] = now.isoformat()
            y.data = issue

        commit_id = self.do_commit([relpath])

        return issue, commit_id

    def update_comment(self, issue_id, comment_id, data):
        relpath = self.relpath(issue_id)
        fullpath = os.path.join(self.repo_path, relpath)

        now = datetime.now(tz=timezone.utc)

        with update_yaml(fullpath) as y:
            issue = y.data
            if 'comments' in issue:
                for c in issue['comments']:
                    if c['id'] == comment_id:
                        c['body'] = LiteralScalarString(data['body'])
                        issue['updated_at'] = now.isoformat()

            y.data = issue

        # TODO: raise error when nothing updated
        commit_id = self.do_commit([relpath])

        return issue, commit_id

    def delete_comment(self, issue_id, comment_id):
        relpath = self.relpath(issue_id)
        fullpath = os.path.join(self.repo_path, relpath)

        now = datetime.now(tz=timezone.utc)

        with update_yaml(fullpath) as y:
            issue = y.data
            if 'comments' in issue:
                comment = next(filter(
                    lambda c: c['id'] == comment_id, issue['comments']
                ))
                issue['comments'].remove(comment)
                issue['updated_at'] = now.isoformat()

            y.data = issue

        # TODO: raise error when nothing updated
        commit_id = self.do_commit([relpath])
        return issue, commit_id
