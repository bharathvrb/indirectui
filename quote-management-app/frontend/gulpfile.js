'use strict';

const fs = require('fs');
const path = require('path');
const gulp = require('gulp');

function clean() {
    return fs.promises.rm(path.join(__dirname, 'dist'), { recursive: true, force: true });
}

function application() {
    return gulp.src('src/**/*', { base: 'src', dot: true })
        .pipe(gulp.dest('dist'));
}

function angular() {
    return gulp.src([
        'node_modules/angular/angular.min.js{,.map}',
        'node_modules/angular-route/angular-route.min.js{,.map}',
        'node_modules/angular-sanitize/angular-sanitize.min.js{,.map}',
        'node_modules/angular-animate/angular-animate.min.js{,.map}'
    ], { base: 'node_modules' })
        .pipe(gulp.dest('dist/vendor'));
}

function bootstrap() {
    return gulp.src([
        'node_modules/bootstrap/dist/css/bootstrap.min.css{,.map}',
        'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js{,.map}'
    ], { base: 'node_modules/bootstrap/dist' })
        .pipe(gulp.dest('dist/vendor/bootstrap'));
}

function icons() {
    return gulp.src([
        'node_modules/bootstrap-icons/font/bootstrap-icons.css',
        'node_modules/bootstrap-icons/font/fonts/*.woff{,2}'
    ], { base: 'node_modules/bootstrap-icons/font' })
        .pipe(gulp.dest('dist/vendor/bootstrap-icons'));
}

function msal() {
    return gulp.src('node_modules/@azure/msal-browser/lib/msal-browser.min.js')
        .pipe(gulp.dest('dist/vendor/msal'));
}

const build = gulp.series(clean, gulp.parallel(application, angular, bootstrap, icons, msal));

function watch() {
    return gulp.watch('src/**/*', build);
}

exports.build = build;
exports.watch = gulp.series(build, watch);
