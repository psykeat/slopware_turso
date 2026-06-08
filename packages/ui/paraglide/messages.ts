export const m: any = new Proxy(
  {},
  {
    get: (_target, prop) => () => String(prop),
  },
);
