# ADR 0001: Direct Vite scaffold

Status: accepted

The installed Convex quickstart generates Next.js, while the product contract requires React and Vite and the current static-hosting component explicitly supports Vite. We will scaffold a standard Vite project directly and apply the Convex expert rules. This avoids carrying an unused framework and follows the quickstart degradation rule for a standard Convex project.
