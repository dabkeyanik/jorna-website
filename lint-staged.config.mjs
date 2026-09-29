// Each app lints and typechecks itself, and only when one of its own files
// is staged. tsc checks a whole project, not files, so it runs once per app.
const app = (dir) => ({
  [`${dir}/web/**/*.{js,jsx,ts,tsx}`]: (files) => [
    `npm --prefix ${dir}/web run lint -- ${files.join(" ")}`,
    `npm --prefix ${dir}/web run typecheck`,
  ],
});

export default {
  ...app("apps/client"),
  ...app("apps/vendor"),
  "packages/shared/**/*.{js,jsx,ts,tsx}": (files) => [
    `npm --workspace @jorna/shared run lint -- ${files.join(" ")}`,
    "npm --workspace @jorna/shared run typecheck",
  ],
};
