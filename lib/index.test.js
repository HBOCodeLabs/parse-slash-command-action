// Copyright (c) WarnerMedia Direct, LLC. All rights reserved. Licensed under the MIT license.
// See the LICENSE file for license information.

const core = require('@actions/core');
const github = require('@actions/github');
const action = require('.');

describe('parse-slash-command', () => {
    let $processEnv = {};

    beforeEach(() => {
        $processEnv = { ...process.env };

        jest.spyOn(core, 'setOutput').mockReturnValue();
        jest.spyOn(core, 'info').mockReturnValue();

        process.env['INPUT_REPO-TOKEN'] = 'cafe43';
        process.env['INPUT_CONFIGURATION-PATH'] = '.github/slash-commands.yaml';
        process.env['INPUT_CONFIGURATION-REF'] = 'aabbcc';
    });

    afterEach(() => {
        process.env = $processEnv;
    });

    describe('main', () => {
        beforeEach(() => {
            jest.spyOn(action, 'getConfig').mockReturnValue({
                commands: [
                    {
                        name: 'order',
                        aliases: 'gimme',
                        commands: [
                            {
                                name: 'pizza',
                                result: {
                                    action: 'order-pizza'
                                }
                            },
                            {
                                name: 'nachos',
                                aliases: ['chips', 'cheese'],
                                result: {
                                    action: 'order-nachos'
                                }
                            }
                        ]
                    }
                ]
            });
        });

        it('returns user-defined props and default reaction if command matches', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order nachos'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: 'order-nachos'
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('returns user-defined props and default reaction if command matches using aliases', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/gimme chips'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: 'order-nachos'
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('ignores extra content after a valid command', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order nachos\n\n(the developers are hungry)'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: 'order-nachos'
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('if provided, will load configuration from a custom path and ref', async () => {
            process.env['INPUT_CONFIGURATION-PATH'] = 'commands.yaml';
            process.env['INPUT_CONFIGURATION-REF'] = 'config-branch';

            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order pizza'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), 'commands.yaml', 'config-branch');
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: 'order-pizza'
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('returns error reaction and message if no command matches', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/pizza sauce'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('message', '> Unknown command `/pizza` - try one of `[/order]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('returns error reaction and message if a subcommand does not match', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order sirloin'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('message', '> Unknown command `/order sirloin` - try one of `/order [pizza, nachos]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('returns error reaction and message if a command is incomplete', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order '
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('message', '> Incomplete command `/order` - try one of `/order [pizza, nachos]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('returns error reaction and message, containing an alias, if command is incomplete', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/gimme '
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('message', '> Incomplete command `/gimme` - try one of `/gimme [pizza, nachos]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('will ignore a valid command if it is not the beginning of the message', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/apple /order pizza'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('message', '> Unknown command `/apple` - try one of `[/order]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });
    });

    describe('getConfig', () => {
        it('returns an object containing the YAML config data from current sha', async () => {
            process.env['GITHUB_REPOSITORY'] = 'AcmeCorp/RocketSled';
            github.context = new github.context.constructor();

            const mockOctokit = {
                repos: {
                    getContent: jest.fn().mockReturnValue({
                        data: {
                            content: 'value1: 3\nvalue2: 4',
                            encoding: 'utf8'
                        }
                    })
                }
            };

            const result = await action.getConfig(mockOctokit, 'path/to/config.yaml', 'aabbcc');

            expect(result).toEqual({ value1: 3, value2: 4 });

            expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
                owner: 'AcmeCorp',
                repo: 'RocketSled',
                ref: 'aabbcc',
                path: 'path/to/config.yaml'
            });
        });
    });
});
