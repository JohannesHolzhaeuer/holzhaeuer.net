# holzhaeuer.net

This is the content of <https://holzhaeuer.net>

## Local preview

Install the dependencies and generate the icon assets before serving the site:

```sh
npm install
npm run icons
```

`npm run icons` downloads the current Gravatar picture and regenerates the
favicons, app icons and Windows tiles. These files are not versioned. The
deploy workflow runs the same command before publishing.
