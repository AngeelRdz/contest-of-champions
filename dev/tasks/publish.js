import gulp from 'gulp';
import gutil from 'gulp-util';
import plumber from 'gulp-plumber';
import sequence from 'gulp-sequence';
import commit from 'gulp-gh-pages';

const DEVELOPMENT = gutil.env.dev;

gulp.task('publish:commit', () => {
    return gulp.src([
        './.build/**/*',
        './dev/gh-pages/**/*',
    ])
        .pipe(plumber())
        .pipe(commit({
            push: DEVELOPMENT,
        }));
});

gulp.task('publish', sequence('clean', 'lint', 'build', 'publish:commit', 'clean'));
