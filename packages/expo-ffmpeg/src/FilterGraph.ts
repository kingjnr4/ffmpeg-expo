export type FilterOptionValue = string | number | boolean;

export type FilterOptions =
  | readonly FilterOptionValue[]
  | Readonly<Record<string, FilterOptionValue | undefined>>;

export interface FilterSpec {
  /** FFmpeg filter name, for example `scale` or `overlay`. */
  name: string;
  /** Positional values or named filter options. */
  options?: FilterOptions;
}

export interface FilterChainSpec {
  /** Input link labels without surrounding brackets. */
  inputs?: string | readonly string[];
  /** One or more filters joined into the same filterchain. */
  filters: FilterSpec | readonly FilterSpec[];
  /** Output link labels without surrounding brackets. */
  outputs?: string | readonly string[];
}

const FILTER_NAME_DELIMITERS = /[\s\[\],;:=\\']/;
const OPTION_NAME_DELIMITERS = /[\s\[\],;:=\\']/;
const LABEL_DELIMITERS = /[\[\]]/;
const OPTION_VALUE_ESCAPE_CHARACTERS: ReadonlySet<string> = new Set([
  '\\',
  "'",
  ':',
]);
const GRAPH_VALUE_ESCAPE_CHARACTERS: ReadonlySet<string> = new Set([
  '\\',
  "'",
  '[',
  ']',
  ',',
  ';',
]);

function normalizeList<T>(value: T | readonly T[]): readonly T[] {
  return Array.isArray(value) ? value : [value as T];
}

function validateToken(
  value: string,
  description: string,
  invalidCharacters: RegExp
): void {
  if (value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${description} must be a non-empty, unpadded string`);
  }

  if (invalidCharacters.test(value)) {
    throw new TypeError(`${description} contains an FFmpeg delimiter`);
  }
}

function escapeCharacters(value: string, characters: ReadonlySet<string>): string {
  let escaped = '';

  for (const character of value) {
    if (characters.has(character)) {
      escaped += '\\';
    }
    escaped += character;
  }

  return escaped;
}

function serializeOptionValue(value: FilterOptionValue): string {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('Filter option numbers must be finite');
  }

  // Filter values are parsed once as option values and again as part of the
  // containing graph, so each parser's delimiters need their own escaping.
  const optionEscaped = escapeCharacters(
    String(value),
    OPTION_VALUE_ESCAPE_CHARACTERS
  );
  return escapeCharacters(optionEscaped, GRAPH_VALUE_ESCAPE_CHARACTERS);
}

function serializeOptions(options: FilterOptions): string {
  if (Array.isArray(options)) {
    return options.map(serializeOptionValue).join(':');
  }

  return Object.entries(options)
    .filter((entry): entry is [string, FilterOptionValue] => entry[1] !== undefined)
    .map(([name, value]) => {
      validateToken(name, 'Filter option name', OPTION_NAME_DELIMITERS);
      return `${name}=${serializeOptionValue(value)}`;
    })
    .join(':');
}

function serializeFilter(filter: FilterSpec): string {
  validateToken(filter.name, 'Filter name', FILTER_NAME_DELIMITERS);

  if (filter.options === undefined) {
    return filter.name;
  }

  const options = serializeOptions(filter.options);
  return options.length > 0 ? `${filter.name}=${options}` : filter.name;
}

function serializeLabels(labels: string | readonly string[]): string {
  return normalizeList(labels)
    .map((label) => {
      validateToken(label, 'Filter link label', LABEL_DELIMITERS);
      return `[${label}]`;
    })
    .join('');
}

/** Builds an FFmpeg complex filtergraph without shell quoting. */
export class FilterGraphBuilder {
  private readonly chains: string[] = [];

  /** Add a typed filterchain to the graph. */
  addChain(chain: FilterChainSpec): this {
    const filters = normalizeList(chain.filters);

    if (filters.length === 0) {
      throw new TypeError('Filter chain must contain at least one filter');
    }

    const inputs = chain.inputs === undefined ? '' : serializeLabels(chain.inputs);
    const outputs =
      chain.outputs === undefined ? '' : serializeLabels(chain.outputs);
    const serializedFilters = filters.map(serializeFilter).join(',');

    this.chains.push(`${inputs}${serializedFilters}${outputs}`);
    return this;
  }

  /**
   * Add a complete filterchain without validation or escaping.
   *
   * Use this only when the typed representation cannot express the graph.
   */
  addRawChain(fragment: string): this {
    const chain = fragment.trim();

    if (chain.length === 0) {
      throw new TypeError('Raw filter chain must not be empty');
    }

    this.chains.push(chain);
    return this;
  }

  /** Build the value passed to FFmpeg's `-filter_complex` option. */
  build(): string {
    if (this.chains.length === 0) {
      throw new Error('Cannot build an empty filtergraph');
    }

    return this.chains.join(';');
  }

  /** Build argv entries that can be spread into `run` or `execute`. */
  buildArgs(): string[] {
    return ['-filter_complex', this.build()];
  }
}
