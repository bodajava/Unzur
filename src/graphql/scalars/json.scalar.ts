import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

function parseLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.OBJECT:
      return Object.fromEntries(ast.fields.map((f) => [f.name.value, parseLiteral(f.value)]));
    default:
      // Variables inside literals are not supported.
      return undefined;
  }
}

/** Any JSON value (variant attributes, store setting values). */
export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Any JSON value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral,
});
