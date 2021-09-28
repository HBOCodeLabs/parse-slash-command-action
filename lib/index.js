// Copyright (c) WarnerMedia Direct, LLC. All rights reserved. Licensed under the MIT license.
// See the LICENSE file for license information.

const core = require('@actions/core');
const github = require('@actions/github');
const YAML = require('js-yaml');

const action = {
    async main() {
        const token = core.getInput('repo-token');
        const configPath = core.getInput('configuration-path');
        const configRef = core.getInput('configuration-ref');

        const octokit = github.getOctokit(token);
        const config = await action.getConfig(octokit, configPath, configRef);
        const comment = github.context.payload.comment.body;
        const args = String(comment).trim().split(/[\r\n ]+/);

        core.info(`Validating config: ${JSON.stringify(config, undefined, 2)}`);

        try {
            this.validateConfig(config);
        } catch (error) {
            return this.fail(error.message);
        }

        // Add in the implied forward slash for the first layer of commands. This makes
        // it easier to parse and format error messages later.
        for (let command of config.commands) {
            command.prefix = '/';
        }

        core.info(`Parsing comment: ${comment}`);

        let commands = config.commands;
        let consumed = [];
        let result;
        let incorrectCommand = false;

        for (let arg of args) {
            consumed.push(arg);

            let command = commands.find(command => action.commandMatches(command, arg));
            if (!command) {
                incorrectCommand = true;
                break;
            }

            if (command.result) {
                result = command.result;
                break;
            }

            if (command.commands) {
                commands = command.commands;
            }
        }

        if (result) {
            return this.succeed(result);
        } else {
            let failed = consumed.join(' ');
            let options = commands.map(command => `${command.prefix || ''}${command.name}`).join(', ');
            let prefix = 'Unknown command';
            let suggest = consumed.slice(0, -1).concat(`[${options}]`).join(' ');

            if (!incorrectCommand) {
                prefix = 'Incomplete command';
                suggest = consumed.concat(`[${options}]`).join(' ');
            }

            let error = `${prefix} \`${failed}\` - try one of \`${suggest}\``;
            return this.fail(error);
        }
    },
    async getConfig(octokit, configPath, configRef) {
        let params = {
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: configPath,
            ref: configRef
        };
        core.info(`Retrieve: ${JSON.stringify(params)}`);

        const response = await octokit.repos.getContent({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: configPath,
            ref: configRef
        });
        const text = Buffer.from(response.data.content, response.data.encoding).toString();

        return YAML.load(text);
    },
    validateConfig(config) {
        if (!config || !Array.isArray(config.commands)) {
            throw new Error(`Configuration error: missing \`commands\` array`);
        }

        let queue = config.commands.map(command => ({ context: [], command }));

        while (queue.length > 0) {
            let { context, command } = queue.shift();

            if (!command.name) {
                throw new Error(`Configuration error: a command is missing the \`name\` property`);
            }

            context = context.concat(`${command.prefix || ''}${command.name}`);

            if (command.result && command.commands) {
                throw new Error(`Configuration error: \`${context.join(' ')}\` must contain either a \`result\` or \`commands\` property, but not both`);
            } else if (command.result) {
                // ok
            } else if (command.commands) {
                queue.push(...command.commands.map(subcommand => ({
                    command: subcommand,
                    context
                })));
            } else {
                throw new Error(`Configuration error: \`${context.join(' ')}\` must contain either a \`result\` or \`commands\` property`);
            }
        }
    },
    commandMatches(command, arg) {
        let prefix = command.prefix || '';
        let aliases = command.aliases || [];

        if (!Array.isArray(aliases)) {
            aliases = [aliases];
        }

        if (prefix + command.name === arg) return true;
        for (let alias of aliases) {
            if (prefix + alias === arg) return true;
        }

        return false;
    },
    succeed(result, message) {
        core.info(`Success: ${JSON.stringify(result)}`);
        core.setOutput('result', JSON.stringify(result));
        if (message) {
            core.setOutput('message', `> ${message}`);
        }
        core.setOutput('reaction', 'rocket');
    },
    fail(message) {
        core.info(`Failed: ${message}`);
        core.setOutput('result', '{}');
        core.setOutput('message', `> ${message}`);
        core.setOutput('reaction', 'confused');
    }
};

module.exports = action;

/* istanbul ignore if */
if (require.main === module) {
    // If this file is the entry point for node, run main() immediately.
    // Unexpected errors are passed back to GitHub as failures.
    action.main().catch(error => core.setFailed(error));
}
