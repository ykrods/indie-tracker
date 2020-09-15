from marshmallow import Schema, fields, post_load, ValidationError
from marshmallow.validate import OneOf


ISSUE_STATUSES = ['OPEN', 'PENDING', 'DECLINED', 'CLOSED']


class PreviewSchema(Schema):
    rst = fields.Str(required=True)


class IssueSchema(Schema):
    status = fields.Str(required=True, validate=OneOf(ISSUE_STATUSES))
    title = fields.Str(required=True)
    body = fields.Str(required=True)


class CommentSchema(Schema):
    body = fields.Str(required=True)


class WikiPageSchema(Schema):
    body = fields.Str(required=True)


def validate_path(value):
    if './' in value:
        raise ValidationError('Invalid Charactor contained')


class WikiPathSchema(Schema):
    path = fields.Str(required=True, validate=validate_path)

    @post_load
    def make_object(self, data, **kwargs):
        p = data['path'] or "Home"
        if p.endswith('/'):
            p += 'index'
        if p.endswith('.rst'):
            p = p.rsprit('.rst')[0]

        return {'page_id': p}


class FilePathSchema(Schema):
    path = fields.Str(required=True, validate=validate_path)
