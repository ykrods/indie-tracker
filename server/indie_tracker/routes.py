from aiohttp import web

from indie_tracker import settings
from indie_tracker.handlers import (
    project,
    user_identity,
    preview,
    websocket_handler,
    issue_add,
    issue_update,
    issue_delete,
    issue_comment_add,
    issue_comment_update,
    issue_comment_delete,
    wiki_page,
    wiki_page_update,
    wiki_page_delete,
    file_get,
)


def static_handler(path):
    async def handler(request):
        return web.FileResponse(settings.STATIC_DIR / path)

    return handler


def make_routes():
    routes = [
        # websocket
        web.get('/ws', websocket_handler),

        # api
        web.post('/api/preview', preview),
        web.get('/api/project', project),
        web.get('/api/user_identity', user_identity),

        web.post('/api/issues', issue_add),
        web.put('/api/issues/{id}', issue_update),
        web.delete('/api/issues/{id}', issue_delete),

        web.post('/api/issues/{issue_id}/comments', issue_comment_add),
        web.put('/api/issues/{issue_id}/comments/{id}', issue_comment_update),
        web.delete(
            '/api/issues/{issue_id}/comments/{id}',
            issue_comment_delete
        ),

        web.get(r'/api/wiki/{path:\S*}', wiki_page),
        web.put(r'/api/wiki/{path:\S+}', wiki_page_update),
        web.delete(r'/api/wiki/{path:\S+}', wiki_page_delete),

        # serve uploaded file
        web.get(r'/files/{path:\S+}', file_get),

        # frontend
        web.get('/', static_handler('index.html')),

        # for SPA routing
        web.get('/issues{p:.*}', static_handler('index.html')),
        web.get('/wiki{p:.*}', static_handler('index.html')),

        web.get('/bundle.css', static_handler('bundle.css')),
        web.get('/bundle.css.map', static_handler('bundle.css.map')),
        web.get('/bundle.js', static_handler('bundle.js')),
        web.get('/bundle.js.map', static_handler('bundle.js.map')),
        web.get('/favicon.png', static_handler('favicon.png')),
        web.get('/global.css', static_handler('global.css')),
        web.get(
            '/vendor/docutils/math.css',
            static_handler('vendor/docutils/math.css')
        ),
        web.get(
            '/vendor/pygments/default.css',
            static_handler('vendor/pygments/default.css')
        ),
        web.get(
            '/vendor/mermaid/mermaid-8.8.0.min.js',
            static_handler('vendor/mermaid/mermaid-8.8.0.min.js')
        ),
    ]
    return routes
