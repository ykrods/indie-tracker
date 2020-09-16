import pytest

from dulwich.repo import Repo


@pytest.fixture()
def repo_path(tmpdir):
    """
    Initialized git repository path
    """
    p = tmpdir.mkdir('testrepo')
    r = Repo.init(p)
    r.close()
    return p
