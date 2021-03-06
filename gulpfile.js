/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

const gulp = require('gulp-help')(require('gulp'));
const gls = require('gulp-live-server');
const file = require('gulp-file');
const rename = require('gulp-rename');
const del = require('del');
const cache = require('gulp-cached');
const shell = require('gulp-shell');
const jasmine = require('gulp-jasmine');
const eslint = require('gulp-eslint');
const gutil = require('gulp-util');
const gulpIf = require('gulp-if');
const favicons = require("gulp-favicons");
const runSequence = require('run-sequence');
const argv = require('yargs').argv;
const path = require('path');
const diff = require('gulp-diff');
const change = require('gulp-change');
const bower = require('gulp-bower');

const compileExample = require('./tasks/compile-example');
const sitemap = require('./tasks/compile-sitemap');
const validateExample = require('./tasks/validate-example');
const createExample = require('./tasks/create-example');
const FileName = require('./tasks/lib/FileName');
const Metadata = require('./tasks/lib/Metadata');
const ExampleFile = require('./tasks/lib/ExampleFile');

const paths = {
  dist: {
    dir: 'dist',
    html: 'dist/**/*.html',
    img: 'dist/img',
    video: 'dist/video',
    json: 'dist/json',
    scripts: 'dist/scripts',
    favicons: 'dist/favicons',
    fonts: 'dist/fonts',
  },
  images: 'src/img/*.{png,jpg,gif}',
  favicon: 'src/img/favicon.png',
  samples: 'src/**/*.html',
  metadata: 'src/**/*.json',
  src: 'src',
  scripts: ['tasks/**/*.js', 'gulpfile.js'],
  static: 'static/*.*',
  templates: {
    dir: 'templates',
    files: ['templates/**/*.css', 'templates/**/*.html']
  },
  api: {
    conf: 'api/conf.json'
  },
  tmp: {
    dir: 'tmp'
  },
  videos: 'src/video/*.{mp4,webm}',
  json: 'src/json/*.json',
  scripts: 'src/scripts/*.js',
  fonts: 'src/fonts/*.ttf'
};

const config = {
  templates: {
    root: paths.templates.dir,
    index: 'index.html',
    example: 'example.html',
    newExample: 'new-example.html',
    preview: 'preview.html',
  }, 
  api: {
    host: 'https://amp-by-example-api.appspot.com',
    dist: 'api/dist'
  },
  a4a: {
    template: 'preview-a4a.html',
    defaultWidth: 300,
    defaultHeight: 250,
    adContainerLabelHeight: 22
  },
  host: 'https://ampbyexample.com'
};

gulp.task('serve', 'starts a local webserver (--port specifies bound port)',
  function() {
    const port = argv.port || 8000;
    const server = gls.static(paths.dist.dir, port);
    config.host = "http://localhost:" + port;
    server.start();
    gulp.watch([paths.dist.html, paths.dist.scripts], function(file) {
      setTimeout(function() {
        /* eslint-disable */
        server.notify.apply(server, [file]);
        /* eslint-enable */
      }, 500);
    });
  });

gulp.task('deploy:prod', 'deploy to production server', function(callback) {
  runSequence('clean',
              'robots:allow',
              'build',
              'deploy:site:prod',
              'deploy:api:prod',
              callback);
});

gulp.task('deploy:staging', 'deploy to staging server', function(callback) {
  config.host = 'https://amp-by-example-staging.appspot.com';
  runSequence('clean',
              'robots:disallow',
              'build',
              'deploy:site:staging',
              callback);
});

gulp.task('conf:encode', 'encode the config file', shell.task([
  'openssl aes-256-cbc -e -in ' + paths.api.conf + ' -out ' +
    paths.api.conf + '.enc -pass env:AMP_BY_EXAMPLE_DEPLOY_KEY'
]));

gulp.task('conf:decode', 'decode the config file', shell.task([
  'openssl aes-256-cbc -d -in ' + paths.api.conf + '.enc -out ' +
    paths.api.conf + ' -pass env:AMP_BY_EXAMPLE_DEPLOY_KEY'
]));

gulp.task('deploy:site:prod', 'deploy to production site', shell.task([
  'goapp deploy -application  amp-by-example -version 1'
]));

gulp.task('deploy:api:prod', 'deploy to production api app engine', shell.task([
  'cd api && goapp deploy -application  amp-by-example-api -version 1'
]));

gulp.task('deploy:site:staging', 'deploy to staging app engine', shell.task([
  'goapp deploy -application  amp-by-example-staging -version 1'
]));

gulp.task('copy:images', 'copy example images', function() {
  return gulp.src(paths.images)
      .pipe(cache('img'))
      .pipe(gulp.dest(paths.dist.img));
});

gulp.task('copy:videos', 'copy example videos', function() {
  return gulp.src(paths.videos)
      .pipe(cache('video'))
      .pipe(gulp.dest(paths.dist.video));
});

gulp.task('copy:json', 'copy example json', function() {
  return gulp.src(paths.json)
      .pipe(cache('json'))
      .pipe(gulp.dest(paths.dist.json));
});

gulp.task('copy:fonts', 'copy example fonts', function() {
  return gulp.src(paths.fonts)
      .pipe(cache('fonts'))
      .pipe(gulp.dest(paths.dist.fonts));
});

gulp.task('copy:scripts', 'copy scripts', function() {
  return gulp.src(paths.scripts)
      .pipe(cache('scripts'))
      .pipe(gulp.dest(paths.dist.scripts));
});

gulp.task('copy:license', 'copy license', function() {
  return gulp.src('LICENSE')
      .pipe(cache('static'))
      .pipe(rename(function(path) {
        path.extname = ".txt";
      }))
      .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('copy:static', 'copy static files', function() {
  return gulp.src(paths.static)
      .pipe(cache('static'))
      .pipe(gulp.dest(paths.dist.dir));
});

gulp.task("compile:favicons", function() {
  return gulp.src(paths.favicon)
      .pipe(cache('static'))
      .pipe(favicons({
        appName: "AMP by Example",
        appDescription: "Accelerated Mobile Pages in Action",
        developerName: "Sebastian Benz",
        developerURL: "http://sebastianbenz.de/",
        background: "#607D8B",
        path: "/favicons/",
        url: Metadata.HOST,
        display: "standalone",
        orientation: "none",
        version: 1.0,
        logging: false,
        online: false,
        html: "favicons.html",
        pipeHTML: true,
        replace: true,
        "icons": {
          "opengraph": false,
          "twitter": false
        }
      }))
      .on("error", gutil.log)
      .pipe(gulp.dest(paths.dist.favicons));
});

gulp.task('validate:example', 'validate example html files', function() {
  return gulp.src(paths.samples)
    .pipe(compileExample(config))
    .pipe(validateExample());
});

gulp.task('compile:example', 'generate index.html and examples', function() {
  return gulp.src(paths.samples)
      .pipe(compileExample(config))
      .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('compile:sitemap', 'generate sitemap.xml', function() {
  return gulp.src(paths.samples)
      .pipe(sitemap(config))
      .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('create', 'create a new AMP example', function() {
  const title = argv.n || argv.name;
  const fileName = FileName.fromString(title);
  if (!fileName) {
    throwInvalidArgumentError('example name missing');
  }
  let examplePath;
  const dest = argv.d || argv.dest;
  const category = argv.c || argv.category;
  if (dest) {
    examplePath = path.join(path.basename(dest), fileName);
  } else if (category) {
    examplePath = FileName.fromString(category, title);
  } else {
    throwInvalidArgumentError('example category or directory missing');
  }
  return file(examplePath, '', {src: true})
      .pipe(createExample(config))
      .pipe(gulp.dest(paths.src));
});

function throwInvalidArgumentError(message) {
  throw new gutil.PluginError({
    plugin: 'create',
    message: gutil.colors.red('\nError: ' + message + '\n\n') +
        gutil.colors.blue('create a new category:\n') +
        'gulp create -n "The Name" -c "The Category"\n\n' +
        gutil.colors.blue('add to existing category:\n') +
        'gulp create -n "The Name" -d src/directory'
  });
}

gulp.task('clean', 'delete all generated resources', function() {
  cache.caches = {};
  return del([paths.dist.dir, config.api.dist]);
});

gulp.task('watch', 'watch for changes in the examples', function() {
  gulp.watch([paths.samples, paths.templates.files, paths.metadata],['compile:example']);
  gulp.watch(paths.images, ['copy:images']);
  gulp.watch(paths.videos, ['copy:videos']);
  gulp.watch(paths.scripts, ['copy:scripts']);
  gulp.watch(paths.static, ['copy:static']);
});

gulp.task('test', function() {
  return gulp.src('spec/**/*Spec.js')
      .pipe(jasmine());
});

gulp.task('lint', function() {
  const hasFixFlag = argv.fix;
  let errorsFound = false;
  return gulp.src(paths.scripts, {base: './'})
      .pipe(eslint({fix: hasFixFlag}))
      .pipe(eslint.formatEach('stylish', function(msg) {
        errorsFound = true;
        gutil.log(gutil.colors.red(msg));
      }))
      .pipe(gulpIf(isFixed, gulp.dest('.')))
      .on('end', function() {
        if (errorsFound && !hasFixFlag) {
          gutil.log(gutil.colors.blue('Run `gulp lint --fix` to ' +
          'fix some of these lint warnings/errors. This is a destructive ' +
          'operation (operates on the file system) so please make sure ' +
          'you commit before running.'));
          process.exit(1);
        }
      });
});

gulp.task('default', 'Run a webserver and watch for changes', [
  'build',
  'watch',
  'serve']);

gulp.task('backend:watch', 'run the go backend and watch for changes', function(callback) {
  config.host = 'http://localhost:8080';
  runSequence(
    'build',
    'watch',
    'backend:serve',
    callback);
});

gulp.task('backend:serve', 'Run the go backend', shell.task([
  'goapp serve'
]));

gulp.task('api:serve', 'Run the go api backend', shell.task([
  'cd api && goapp serve -admin_port=8100'
]));

gulp.task('validate', 'runs all checks', ['lint', 'test', 'validate:example']);

gulp.task('snapshot',
    'Saves a snapshot of the generated sample files',
    function() {
      return gulp.src(paths.samples)
        .pipe(compileExample(config, false))
        .pipe(gulp.dest(paths.tmp.dir));
    }
);

gulp.task('snapshot:verify',
    'Compares generated samples against snapshot',
    function() {
      return gulp.src(paths.samples)
        .pipe(compileExample(config, false))
        .pipe(diff(paths.tmp.dir))
        .pipe(diff.reporter({fail: true}));
    }
);

gulp.task('robots:disallow', 'generate robots.txt disallowing robots to access', function() {
  return generateRobotsTxt(`User-Agent: *
Disallow: /
`);
});

gulp.task('robots:allow', 'generate robots.txt allowing robots to access', function() {
  return generateRobotsTxt(`User-Agent: *
Disallow: 
`);
});

function generateRobotsTxt(contents) {
  return file('robots.txt', contents, { src: true })
    .pipe(gulp.dest('dist'));
}

/* adds a canonical link to sample files */
function performChange(content) {
  const exampleFile = ExampleFile.fromPath(this.file.path);
  const canonical = config.host + exampleFile.url();
  if (!/<link rel="canonical"/.test(content)) {
    content = content.replace(/<meta charset="utf-8">/g,
    '<meta charset="utf-8">\n  <link rel="canonical" href="'
    + canonical + '">');
    gutil.log("updating canonical: " + this.file.relative);
  }
  return content;
}

gulp.task('change', 'use this task to batch change samples', function() {
  return gulp.src('src/**/*.html')
        .pipe(change(performChange))
        .pipe(gulp.dest('src/'));
});

gulp.task('bower', function() {
  return bower()
});

gulp.task('build', 'build all resources', [
  'bower',
  'copy:images',
  'copy:videos',
  'copy:json',
  'copy:fonts',
  'copy:scripts',
  'copy:license',
  'copy:static',
  'compile:favicons',
  'compile:sitemap',
  'compile:example'
]);

function isFixed(file) {
  return file.eslint.fixed;
}
