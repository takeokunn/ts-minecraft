# Platform Abstractions

ブラウザ・Node.js といった実行環境固有の機能を抽象化するためのレイヤーです。Infrastructure 層が依存し、Application や Domain 層には漏れないように設計します。

- `environment`: 環境変数や設定読み込み。
- `storage`: ストレージ、ファイルシステム抽象化。
- `rendering`: レンダリングバックエンドへのブリッジ。
