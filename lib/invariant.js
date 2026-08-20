// src/invariant.ts
var PACKAGE_NAME = "dsh-theme-mineradio";
var name = "client-ui-mineradio-invariant";
var inject = ["invariants"];
var install = () => {
};
var apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
export {
  apply,
  inject,
  name
};
