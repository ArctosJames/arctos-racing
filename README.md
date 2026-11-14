# Arctos Racing workshop

A small website for running the team's cars: part numbers and the parts database, service life tracking, pre-session checklists, packing lists and a run log.

It is plain HTML, CSS and JavaScript with no build step.

## Put it online with GitHub Pages

1. Create a repository and upload every file in this folder to it (including `.nojekyll`).
2. In the repository go to Settings, then Pages, choose "Deploy from a branch", pick `main` and `/ (root)`, and save.
3. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

GitHub Pages on a free account needs the site repository to be public. That is fine: the site files contain no team data.

## Sync data between devices

Data is saved in the browser on each device. To share it between devices:

1. Create a second, **private** repository for the data, for example `arctos-data`, with at least one file in it (tick "Add a README").
2. On GitHub go to Settings, Developer settings, Personal access tokens, Fine-grained tokens. Create a token limited to that one repository with the permission "Contents: read and write".
3. On each device open the site, go to Settings, fill in the owner, repository and token, and press "Turn on sync".

The first device uploads its data; later devices load it. Changes sync a few seconds after you make them and whenever you reopen the site. With no signal, changes are kept on the device and sync when you are back online.

## How service life is counted

- Each fitted component has a life in running hours, sessions or calendar months.
- Logging a session in the run log adds its minutes and one session to every component fitted to that car.
- Calendar lives count from the fitted date.
- "Mark done" records what was done in the component's history and restarts the count.
- A component shows as due soon at 80% of its life and overdue at 100%.

The parts, lives and checklists the site starts with are examples only. Replace them with the figures for your cars.
