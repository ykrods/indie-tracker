from json import JSONDecodeError
from mimetypes import guess_type

from aiohttp import (
    web,
    WSMsgType,
)

from indie_tracker.converter import rst2html
from indie_tracker.handlerlibs import (
    validate_match_info,
    validate_request_data,
    notify,
)
from indie_tracker.repositories import (
    BaseGitRepository,
    ProjectRepository,
    IssueRepository,
    WikiRepository,
    FileRepository,
)
from indie_tracker.schemas import (
    PreviewSchema,
    IssueSchema,
    CommentSchema,
    WikiPageSchema,
    WikiPathSchema,
    FilePathSchema,
)
from indie_tracker.ws_handlers import handle_ws_message


@validate_request_data(PreviewSchema())
async def preview(request):
    result = rst2html(request['data']['rst'])
    return web.json_response({'html': result})


async def project(request):
    project_repository = ProjectRepository(request.app['repo_path'])
    return web.json_response(project_repository.get())


async def user_identity(request):
    git_repository = BaseGitRepository(request.app['repo_path'])
    return web.json_response(git_repository.user_identity())


@validate_request_data(IssueSchema())
async def issue_add(request):
    issue_repository = IssueRepository(request.app['repo_path'])

    issue, commit_id = issue_repository.create(request['data'])

    await notify(
        {'type': 'issue', 'data': issue, 'commit': commit_id},
        request.app
    )

    return web.json_response({})


@validate_request_data(IssueSchema())
async def issue_update(request):
    issue_repository = IssueRepository(request.app['repo_path'])

    issue, commit_id = issue_repository.update(
        request.match_info['id'],
        request['data'],
    )

    await notify(
        {'type': 'issue', 'data': issue, 'commit': commit_id},
        request.app
    )

    return web.json_response({})


async def issue_delete(request):
    issue_repository = IssueRepository(request.app['repo_path'])
    commit_id = issue_repository.delete(request.match_info['id'])

    await notify(
        {
            'type': 'issue_deleted',
            'id': request.match_info['id'],
            'commit': commit_id
        },
        request.app
    )

    return web.Response(text="", status=204)


@validate_request_data(CommentSchema())
async def issue_comment_add(request):
    issue_repository = IssueRepository(request.app['repo_path'])

    issue, commit_id = issue_repository.add_comment(
        request.match_info['issue_id'],
        request['data']
    )

    await notify(
        {'type': 'issue', 'data': issue, 'commit': commit_id},
        request.app
    )

    return web.json_response({})


@validate_request_data(CommentSchema())
async def issue_comment_update(request):
    issue_repository = IssueRepository(request.app['repo_path'])

    issue, commit_id = issue_repository.update_comment(
        request.match_info['issue_id'],
        request.match_info['id'],
        request['data']
    )

    await notify(
        {'type': 'issue', 'data': issue, 'commit': commit_id},
        request.app
    )

    return web.json_response({})


async def issue_comment_delete(request):
    issue_repository = IssueRepository(request.app['repo_path'])

    issue, commit_id = issue_repository.delete_comment(
        request.match_info['issue_id'],
        request.match_info['id']
    )

    await notify(
        {'type': 'issue', 'data': issue, 'commit': commit_id},
        request.app
    )

    return web.json_response({})


@validate_match_info(WikiPathSchema())
async def wiki_page(request):
    page_id = request['route_params']['page_id']

    wiki_repository = WikiRepository(request.app['repo_path'])
    return web.json_response(wiki_repository.get(page_id))


@validate_match_info(WikiPathSchema())
@validate_request_data(WikiPageSchema())
async def wiki_page_update(request):
    page_id = request['route_params']['page_id']

    wiki_repository = WikiRepository(request.app['repo_path'])
    wiki_page = wiki_repository.save(page_id, request['data'])

    return web.json_response(wiki_page)


@validate_match_info(WikiPathSchema())
async def wiki_page_delete(request):
    page_id = request['route_params']['page_id']

    wiki_repository = WikiRepository(request.app['repo_path'])
    wiki_page = wiki_repository.delete(page_id)

    return web.json_response(wiki_page)


@validate_match_info(FilePathSchema())
async def file_get(request):
    path = request['route_params']['path']

    file_repository = FileRepository(request.app['repo_path'])
    body = file_repository.get(path)
    content_type, _ = guess_type(path)
    if body:
        return web.Response(body=body, content_type=content_type)
    else:
        return web.Response(text="Not Found", status=404)


async def websocket_handler(request):
    git_repository = BaseGitRepository(request.app['repo_path'])

    # XXX: Prevent mismatching of project
    if (not request.query.get('name') or
            request.query['name'] != git_repository.repo_name()):
        return web.json_response(
            {'error': {'_': 'Something went wrong.... please reload'}},
            status=400,
        )

    ws = web.WebSocketResponse()
    await ws.prepare(request)
    request.app["sockets"].add(ws)

    async for msg in ws:
        if msg.type == WSMsgType.TEXT:
            try:
                data = msg.json()
            except JSONDecodeError:
                print("Invalid json")
                continue

            handle_ws_message(ws, data, request.app)

        elif msg.type == WSMsgType.ERROR:
            # XXX:これどういう時エラーになるんだ
            print(ws.exception())

    request.app["sockets"].remove(ws)

    return ws
