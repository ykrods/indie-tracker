import os

from .base_git_repository import BaseGitRepository


class FileRepository(BaseGitRepository):
    def relpath(self, path):
        return os.path.join('files', path)

    def get(self, path):
        relpath = self.relpath(path)

        return self.get_content_by_path(relpath, raw=True)
