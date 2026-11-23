HUF-connect-MAC-（HU connect MAC診断テスト版）
既存のHU connect機能を保持し、Wi-Fiモジュールの診断コマンド送信と応答取得を分離しました。
追加ブロック
`Wi-Fiモジュールに問い合わせる コマンド`：指定コマンドをUARTで送信し、応答を内部に保存します。初期値 `wifi_mac` は未確認の診断コマンドです。
`Wi-Fiモジュールの応答`：直前の問い合わせで保存した応答文字列を返す値ブロックです。
使用例
`[Grove - UART WiFi V2] 通信端子 P0/P14` を設定します。
`Wi-Fiモジュールに問い合わせる コマンド wifi_mac` を実行します。
`Wi-Fiモジュールの応答` を文字列表示またはシリアル出力に接続します。
注意：`wifi_mac` が現在のRoboBlocksファームウェアでサポートされるかは未確認です。`invalid_command` が返る場合、ブロックの形ではなくファームウェア側がそのコマンドを認識していないことを意味します。ファームウェアは変更しません。

GitHub repository: https://github.com/okada519-tech/HUF-connect-MAC-
