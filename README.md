# parse-slash-command-action

> Parse a "slash command" left in a PR comment.

This action is designed to take a comment on a pull request containing a "slash command", and parse it, returning a custom blob of JSON data based on the command entered. The slash command can be any length, the only requirement is that it starts with a slash (`/`).

To use this action, create a configuration YAML file in your project, containing the commands allowed, and the data you'd like to return for each. Usually this file lives at `.github/slash-commands.yaml`, although you can configure a different path.

To support commands with "arguments", the YAML file allows you to nest commands -- for example, you can support the slash command `/deploy qa` by creating a `deploy` command with a nested `qa` command.

Here's an example configuration file:

```yaml
commands:
  - name: deploy
    commands:
      - name: qa
        result:
          action: pipeline
          id: 48
      - name: staging
        result:
          action: pipeline
          id: 57
  - name: helloworld
    result:
      say: hello
```

Given this configuration file, the following slash commands are supported:

Command | Result
------- | ------
`/deploy qa` | `{"action":"pipeline","id":48}`
`/deploy staging` | `{"action":"pipeline","id":57}`
`/helloworld` | `{"say":"hello"}`

Each command can define a nested `commands` property (for longer subcommands). Leaf nodes should contain a `result` property, which defines the user-defined properties to return from the action. A JSON blob containing all of the user-defined properties will be returned in the `outputs.result` value for the step in your workflow.

Note that the user-defined properties do not have any meaning on their own -- it's up to your workflow to take some action, if appropriate, based on the results from this action.

## Inputs

Input Name    | Required? | Description
----------    | --------- | -----------
`configuration-path` | No | path to your configuration YAML file (usually `.github/slash-commands.yaml`)
`repo-token`  | Yes       | the API token to use for access (usually GITHUB_TOKEN)

## Outputs

Output Name  | Description
-----------  | -----------
`message`    | message to add to the user's comment
`reaction`   | reaction emoji to add to the PR comment
`result`     | the result body if a command matched, or `{}` if not

## Changelog

Note: for the versions listed below, your workflows can refer to either the version tag (`HBOCodeLabs/parse-slash-command-action@v1.0.5`) or the major version branch (`HBOCodeLabs/parse-slash-command-action@v1`).

The major version branch may be updated with backwards-compatible features and bug fixes. Version tags will not be modified once released.

#### 2021-07-11 - `v1.0.0` (`v1`)

 - Initial public release.

## Contributions

Pull requests welcome. To ensure tests pass locally:

```console
npm install
npm test
```
