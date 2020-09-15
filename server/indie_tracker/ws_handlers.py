import asyncio

from indie_tracker.repositories import IssueRepository


async def ping(ws, data, app):
    await ws.send_json({'type': 'pong'})


async def sync(ws, data, app):
    """
    """
    issue_repository = IssueRepository(app['repo_path'])
    async for event in issue_repository.changes(commitid=data["commit"]):
        await ws.send_json(event)

    await ws.send_json({'type': 'sync'})


def handle_ws_message(ws, data, app):
    ws_handlers = {
        'ping': ping,
        'sync': sync,
    }

    if 'type' not in data or data['type'] not in ws_handlers:
        return

    asyncio.create_task(ws_handlers[data['type']](ws, data, app))
