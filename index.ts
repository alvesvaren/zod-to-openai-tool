import {z} from 'zod';


interface Steps<T = void, Omitted extends string = ''> {
  input<S extends z.ZodType<any, any>>(schema: S): Omit<Steps<z.infer<S>, Omitted | 'input'>, 'input' | Omitted>;
  run(func: (input: T extends void ? never : T) => unknown): Omit<Steps<T, Omitted | 'run'>, 'run' | 'input' | Omitted>;
  describe(description: string): Omit<Steps<T, Omitted | 'describe'>, Omitted | 'describe'>;
}

interface Data {
  func: (input: any) => unknown;
  schema: z.ZodType<any, any>;
  description: string | undefined;
}

function tool<T = void>(): Steps<T> & {__getData: () => {func: (input: T extends void ? never : T) => unknown, schema: z.ZodType<any, any>, description: string | undefined}} {
  let schema: z.ZodType<any, any>;
  let description: string | undefined;
  let func: (input: T extends void ? never : T) => unknown;

  return {
    input(s) {
      schema = s;
      return this as unknown as Steps<z.infer<typeof s>>;
    },
    run(f) {
      func = f;
      return this;
    },
    describe(d) {
      description = d;
      return this;
    },
    __getData() {
      return {schema, func, description};
    },
  };
}

tool().input(z.string()).run((input) => input.toUpperCase()).describe('Converts a string to uppercase');