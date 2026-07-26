module.exports = function(eleventyConfig) {

  // Passthrough copy
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/images");

  // Date filter
  eleventyConfig.addFilter("dateFormat", function(date) {
    const d = new Date(date);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  });

  // Reading time filter
  eleventyConfig.addFilter("readingTime", function(content) {
    if (!content) return "1 min read";
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return `${minutes} min read`;
  });

  // Slug filter
  eleventyConfig.addFilter("slug", function(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  });

  // Limit filter
  eleventyConfig.addFilter("limit", function(arr, limit) {
    return arr.slice(0, limit);
  });

  // Where filter for category filtering
  eleventyConfig.addFilter("where", function(arr, key, value) {
    return arr.filter(item => item.data && item.data[key] === value);
  });

  // Sort by date descending
  eleventyConfig.addFilter("sortByDate", function(arr) {
    return [...arr].sort((a, b) => {
      const dateA = a.data && a.data.date ? new Date(a.data.date) : new Date(0);
      const dateB = b.data && b.data.date ? new Date(b.data.date) : new Date(0);
      return dateB - dateA;
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"]
  };
};
