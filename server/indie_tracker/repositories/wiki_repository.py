import os

from .base_git_repository import BaseGitRepository


class WikiRepository(BaseGitRepository):
    def relpath(self, page_id):
        return os.path.join('wiki', page_id + '.rst')

    def get(self, page_id):
        relpath = self.relpath(page_id)

        return {
            'page_id': page_id,
            'body': self.get_content_by_path(relpath)
        }

    def save(self, page_id, data):
        relpath = self.relpath(page_id)
        fullpath = os.path.join(self.repo_path, relpath)

        os.makedirs(os.path.dirname(fullpath), exist_ok=True)
        with open(fullpath, 'w') as f:
            f.write(data['body'])

        self.do_commit([relpath])

        return {'page_id': page_id, 'body': data['body']}

    def delete(self, page_id):
        relpath = self.relpath(page_id)
        fullpath = os.path.join(self.repo_path, relpath)

        os.unlink(fullpath)

        self.do_commit([relpath])

        return {'page_id': page_id, 'body': None}
