// Copyright (c) WarnerMedia Direct, LLC. All rights reserved. Licensed under the MIT license.
// See the LICENSE file for license information.

const core = require('@actions/core');
const github = require('@actions/github');
const Context = require('@actions/github/lib/context');
const action = require('.');

describe('parse-slash-command', () => {
    let $processEnv = {};

    beforeEach(() => {
        $processEnv = { ...process.env };

        jest.spyOn(core, 'setOutput').mockReturnValue();
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
                        commands: [
                            {
                                name: 'pizza',
                                result: {
                                    action: 'order-pizza'
                                }
                            },
                            {
                                name: 'nachos',
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
            process.env['INPUT_REPO-TOKEN'] = 'cafe43';
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order nachos'
                }
            };

            await action.main();

            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: 'order-nachos'
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('returns error reaction and message if no command matches', async () => {
            process.env['INPUT_REPO-TOKEN'] = 'cafe43';
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/pizza sauce'
                }
            };

            await action.main();

            expect(core.setOutput).toHaveBeenCalledWith('message', '> Unknown command `/pizza` - try one of `[/order]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('returns error reaction and message if a subcommand does not match', async () => {
            process.env['INPUT_REPO-TOKEN'] = 'cafe43';
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order sirloin'
                }
            };

            await action.main();

            expect(core.setOutput).toHaveBeenCalledWith('message', '> Unknown command `/order sirloin` - try one of `/order [pizza, nachos]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });
    });

    describe('getConfig', () => {
        it('returns an object containing the YAML config data from current sha', async () => {
            process.env['GITHUB_REPOSITORY'] = 'AcmeCorp/RocketSled';
            process.env['GITHUB_REF'] = 'main';
            process.env['GITHUB_SHA'] = 'aabbccdd';
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

            const result = await action.getConfig(mockOctokit, 'path/to/config.yaml');

            expect(result).toEqual({ value1: 3, value2: 4 });

            expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
                owner: 'AcmeCorp',
                repo: 'RocketSled',
                ref: 'aabbccdd',
                path: 'path/to/config.yaml'
            });
        });
    });
});
