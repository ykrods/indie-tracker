from .base_git_repository import BaseGitRepository


class ProjectRepository(BaseGitRepository):
    def get(self):
        return {
            'name': self.repo_name(),
            'head': self.head(),
        }
