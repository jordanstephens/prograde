module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    watch: {
      files: ["src/prograde.js"],
      tasks: ["browserify"]
    },
    browserify: {
      "dist/prograde.js": ["src/prograde.js"]
    }
  });

  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-browserify");

  // Default task(s).
  grunt.registerTask("default", ["uglify"]);
};
