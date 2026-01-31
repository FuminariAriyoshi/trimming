const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight'),
  markdownIt = require('markdown-it'),
  pluginRss = require('@11ty/eleventy-plugin-rss');
module.exports = (eleventyConfig) => {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPassthroughCopy('favicon.ico');
  eleventyConfig.addPassthroughCopy('assets/fonts');
  eleventyConfig.addPassthroughCopy('js');
  eleventyConfig.addPassthroughCopy('img');
  eleventyConfig.addPassthroughCopy('styles.css');
  eleventyConfig.addPassthroughCopy('load.css');
  eleventyConfig.addPassthroughCopy('load.html');
  eleventyConfig.addPassthroughCopy('404.html');

  // Explicitly sort posts by filename to ensure order matches 01, 02, etc.
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("posts/*.md").sort((a, b) => {
      return a.fileSlug.localeCompare(b.fileSlug);
    });
  });

  const options = {
    html: true,
    breaks: true,
    linkify: false
  };
  eleventyConfig.setLibrary('md', markdownIt(options));

  return {
    // Use liquid in html templates
    htmlTemplateEngine: 'liquid'
  };
};
