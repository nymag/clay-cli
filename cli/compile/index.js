'use strict';
const h = require('highland'),
  _ = require('lodash'),
  chalk = require('chalk'),
  pluralize = require('pluralize'),
  compile = require('../../lib/cmd/compile'),
  options = require('../cli-options'),
  reporter = require('../../lib/reporters'),
  helpers = require('../../lib/compilation-helpers');

function builder(yargs) {
  return yargs
    .usage('Usage: $0 compile [asset type]')
    .command(require('./fonts'))
    .command(require('./media'))
    .command(require('./styles'))
    .command(require('./templates'))
    .example('$0 compile', 'compile all assets')
    .example('$0 compile --watch', 'compile and watch all assets')
    .option('w', options.watch)
    .option('m', options.minify)
    // font-specific options
    .option('i', options.inlined)
    .option('l', options.linked)
    // style-specific options
    .option('p', options.plugins)
    // reporter option
    .option('r', options.reporter);
}

function handler(argv) {
  const t1 = Date.now(),
    plugins = _.map(argv.plugins, (pluginName) => {
      try {
        return require(pluginName)();
      } catch (e) {
        console.error(`${chalk.red('Error: Cannot init plugin "' + pluginName + '"')}\n${chalk.grey(e.message)}`);
      }
    }),
    fonts = compile.fonts({
      watch: argv.watch,
      minify: argv.minify,
      inlined: argv.inlined,
      linked: argv.linked
    }),
    media = compile.media({ watch: argv.watch }),
    styles = compile.styles({
      watch: argv.watch,
      minify: argv.minify,
      plugins
    }),
    templates = compile.templates({
      watch: argv.watch,
      minify: argv.minify
    }),
    tasks = [fonts, media, styles, templates],
    builders = _.map(tasks, (task) => task.build),
    watchers = _.map(tasks, (task) => task.watch),
    isWatching = !!watchers[0];

  return h(builders)
    .merge()
    .map(reporter.logAction(argv.reporter, 'compile'))
    .toArray((results) => {
      const t2 = Date.now();

      reporter.logSummary(argv.reporter, 'compile', (successes) => {
        let message = `Compiled ${argv.minify ? 'and minified ' : '' }${pluralize('file', successes, true)} in ${helpers.time(t2, t1)}`;

        if (isWatching) {
          message += '\nWatching for changes...';
        }
        return { success: true, message };
      })(results);

      if (isWatching) {
        _.each(watchers, (watcher) => {
          watcher.on('raw', helpers.debouncedWatcher);
        });
      }
    });
}

module.exports = {
  command: 'compile [asset type]',
  describe: 'Compile fonts, media, styles, scripts, and templates',
  aliases: ['compiler', 'c'],
  builder,
  handler
};