import logging

from aiohttp import web
from aiohttp.web_exceptions import HTTPNotFound


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


@web.middleware
async def error_middleware(request, handler):
    """return json reponse on internal error"""
    try:
        return await handler(request)
    except HTTPNotFound:
        return web.json_response({'error': {'_': 'Not Found'}}, status=404)
    except Exception as e:
        logger.exception('Error: %s', e)
        return web.json_response(
            {'error': {'_': 'Internal Server Error'}},
            status=500,
        )
