import logging

from aiohttp import web

from indie_tracker import settings
from indie_tracker.middlewares import error_middleware
from indie_tracker.routes import make_routes


def make_app(repo_path):
    app = web.Application(middlewares=[error_middleware])
    app.add_routes(make_routes())

    app['settings'] = settings
    app['repo_path'] = repo_path
    app['sockets'] = set()
    # app.on_startup.append(on_startup)

    return app


def serve(repo_path):
    logging.basicConfig(level=logging.DEBUG)
    web.run_app(make_app(repo_path), port=settings.PORT)
