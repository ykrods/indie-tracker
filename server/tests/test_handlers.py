import pytest

from importlib import reload

from aiohttp import web


@pytest.fixture
async def client(aiohttp_client, repo_path):
    # os.environ['PROJECTS_DIR'] = str(projects_dir)
    from indie_tracker import settings
    reload(settings)
    from indie_tracker.server import make_app

    return await aiohttp_client(make_app(repo_path))


async def test_preview(client):
    res = await client.post('/api/preview',
                            json={'rst': '* foo\n* bar'})
    assert res.status == web.HTTPOk.status_code
