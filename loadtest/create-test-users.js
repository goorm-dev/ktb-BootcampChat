#!/usr/bin/env node

const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');

const argv = yargs(hideBin(process.argv))
  .option('count', {
    alias: 'c',
    description: 'Number of test users to create',
    type: 'number',
    default: 100
  })
  .option('api-url', {
    description: 'Backend REST API URL',
    type: 'string',
    default: 'http://localhost:5001'
  })
  .option('start-index', {
    alias: 's',
    description: 'Starting index for user numbering',
    type: 'number',
    default: 0
  })
  .help()
  .alias('help', 'h')
  .argv;

async function createTestUsers(config) {
  console.log(chalk.bold.cyan('\n=== Creating Test Users ===\n'));
  console.log(chalk.gray(`Creating ${config.count} test users...`));
  console.log(chalk.gray(`API URL: ${config.apiUrl}`));
  console.log(chalk.gray(`Starting index: ${config.startIndex}\n`));

  let created = 0;
  let failed = 0;
  let existing = 0;

  for (let i = config.startIndex; i < config.startIndex + config.count; i++) {
    const email = `loadtest-${i}@test.com`;
    const password = 'Test1234!';
    const name = `LoadTest User ${i}`;

    try {
      await axios.post(
        `${config.apiUrl}/api/auth/register`,
        { email, password, name },
        { timeout: 5000 }
      );

      created++;
      process.stdout.write(chalk.green('✓'));

    } catch (error) {
      if (error.response?.status === 409) {
        // User already exists
        existing++;
        process.stdout.write(chalk.yellow('○'));
      } else {
        failed++;
        process.stdout.write(chalk.red('✗'));
        console.log(chalk.red(`\nFailed to create ${email}:`), error.message);
      }
    }

    // Add small delay to avoid overwhelming the server
    if ((i + 1) % 10 === 0) {
      process.stdout.write(` ${i + 1 - config.startIndex}/${config.count}\n`);
      await sleep(100);
    }
  }

  console.log('\n');
  console.log(chalk.green(`✓ Created: ${created}`));
  console.log(chalk.yellow(`○ Already existed: ${existing}`));
  console.log(chalk.red(`✗ Failed: ${failed}`));
  console.log(chalk.bold.green(`\n✓ Done! Total available: ${created + existing}\n`));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

createTestUsers({
  count: argv.count,
  apiUrl: argv.apiUrl,
  startIndex: argv.startIndex
}).catch(error => {
  console.error(chalk.red('\nFatal error:'), error.message);
  process.exit(1);
});
