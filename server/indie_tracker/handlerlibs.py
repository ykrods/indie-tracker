from functools import wraps
from json import JSONDecodeError

from aiohttp import web
from marshmallow import ValidationError


async def notify(data, app):
    # Simply send messages to all active sockets
    for ws in app["sockets"]:
        await ws.send_json(data)


def validate_match_info(schema):
    def deco(func):
        @wraps(func)
        async def wrapped(request):
            try:
                route_params = schema.load(request.match_info)
            except ValidationError:
                # user does not know what are params, so simply return 400
                return web.json_response(
                    {'error': {'_': 'Invalid URL'}},
                    status=400,
                )

            request['route_params'] = route_params
            return await func(request)
        return wrapped
    return deco


def validate_request_data(schema):
    def deco(func):
        @wraps(func)
        async def wrapped(request):
            if request.content_type != 'application/json':
                return web.json_response(
                    {'error': {'_': 'Unxepected Content-Type'}},
                    status=400,
                )

            try:
                raw_data = await request.json()
            except JSONDecodeError:
                return web.json_response(
                    {'error': {'_': 'Invalid json'}},
                    status=400,
                )

            try:
                data = schema.load(raw_data)
            except ValidationError as e:
                return web.json_response(
                    {'error': e.messages},
                    status=400,
                )

            request['data'] = data
            return await func(request)
        return wrapped
    return deco
