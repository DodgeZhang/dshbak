# DSH 插件 Git 同步备份 / DSH Plugin Git Sync backup

本仓库由 **DSH 插件 Git 同步 / DSH Plugin Git Sync**（`dsh-plugins-git-sync`）自动写入。
This repository is written automatically by **DSH Plugin Git Sync** (`dsh-plugins-git-sync`).

- 请勿手动修改这些文件；下次同步会按清单格式校验，非法内容会被拒绝。
  Do not edit these files by hand: the next sync validates them and rejects malformed input.
- 这里只保存插件清单、版本、来源和已部署技能文件；**不会**保存插件配置、Token、密码、私钥、Cookie 或机器绝对路径。
  Only plugin inventory, versions, sources, enablement and the deployed DSH skills are stored here. Plugin configuration, Agent presets and UI settings are never written. Tokens, passwords, private keys, cookies and machine paths are never written.
- 恢复前请在「DSH 插件 Git 同步」设置页查看预览；破坏性操作需要确认。
  Preview restores in the "DSH Plugin Git Sync" settings page; destructive operations require confirmation.

目录结构 / layout:

```text
manifest.json                          schema version, per-profile plugin counts, devices
metadata/schema.json                   machine-readable description of this layout
profiles/<profile>/plugins.json        shared desired plugin state (with tombstones)
profiles/<profile>/skills/<name>/...    deployed DSH skills, as real files
profiles/<profile>/configs/<id>.json   legacy filtered plugin configuration (no longer written)
devices/<deviceId>/<profile>.json      last published inventory of one device
```
