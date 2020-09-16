import os

from time import time, localtime

from dulwich.porcelain import get_object_by_path
from dulwich.repo import (
    Repo,
    get_user_identity,
)


class BaseGitRepository:
    def __init__(self, repo_path, RepoClass=Repo):
        """
        repo_path: abspath of repository
        """
        self.repo_path = repo_path
        self.RepoClass = RepoClass

    def repo_name(self):
        return os.path.basename(self.repo_path)

    def repo(self):
        """open git repository with dulwich"""
        return self.RepoClass(self.repo_path)

    def head(self, opened=None):
        if opened:
            if opened.refs.as_dict():
                return opened.head().decode('utf-8')
            else:
                return None

        with self.repo() as r:
            return r.head().decode('utf-8') if r.refs.as_dict() else None

    def user_identity(self):
        with self.repo() as r:
            config = r.get_config_stack()
            return {'user_identity': get_user_identity(config).decode('utf-8')}

    def do_commit(self, paths, message="Commit via Indie Tracker"):
        with self.repo() as r:
            r.stage([p.encode('utf-8') for p in paths])

            # * commtter/author is determined by git config
            # * timezone is determined by system's timezone or os.environ['TZ']
            ts = int(time())
            tz = localtime().tm_gmtoff
            commit_id = r.do_commit(
                message=message.encode('utf-8'),
                commit_timestamp=ts,
                author_timestamp=ts,
                commit_timezone=tz,
                author_timezone=tz,
            )
            return commit_id.decode('utf-8')

    def get_content_by_path(self, relpath, raw=False):
        with self.repo() as r:
            try:
                ret = get_object_by_path(r, relpath).data
                if raw:
                    return ret
                else:
                    return ret.decode('utf-8')
            except KeyError:
                return None
