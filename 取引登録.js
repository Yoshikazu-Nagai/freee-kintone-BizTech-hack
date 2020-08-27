/* eslint-disable linebreak-style */
/*
 * プログラム名：取引登録
 * サブドメイン：fk-biztech
 * 内容説明：・レコード一覧画面が表示されたら発動し、freeeアプリへアクセストークンを取得するOauth経由のリクエストを送信。
 *            アクセストークンの取得の際に使用するclient_idはfreee認証用アプリからレコードを取得し、そのフィールドの値を使用する。
 *          ・レコード詳細画面でステータスが「請求済」まで進んだら発動する。
 *          　freeeアプリへOAuth経由でアクセストークンを確認し、
 *          　stateのパラメータとともに整合性を確認できた場合、
 *          　freee APIのcompaniesエンドポイントから事業所を取得する。表示名が「APIチームデモアカウント（100名招待可）」の事業所IDを取得する
 *          　freee APIのdealsエンドポイントに対してPOSTで追加する。
 *          　デモ環境なので追加する項目は以下のみとする。
 *          　issue_date(発生日)、type(収支区分)、company_id(事業所ID)、partner_code(取引先コード)、
 *          　detail(tax_code(税区分コード)、account_item_id(勘定科目ID)、amount(取引金額))のみを修正する。
 *          　account_item_id(勘定科目ID)は365746891(売掛金)、tax_code(税区分コード)は21(課税売上)を固定でPOSTリクエストに含める。
 * 対象アプリ：取引管理(freee & kintone BizTech hack) アプリID：変動
 * 参照先アプリ：freee認証用(freee & kintone BizTech hack) アプリID：変動
 * 参照先ライブラリ：https://js.cybozu.com/jquery/3.4.1/jquery.min.js
 * 備考：
 *     Copyright (c) 2020 Akvabit
 *     Released under the MIT license.
 *     see https://opensource.org/licenses/MIT
 *
 */
(function ($) {
	'use strict';
	let accesstoken = '';
	let companyid = '';

	const GenerateUuid = function () {
		// https://github.com/GoogleChrome/chrome-platform-analytics/blob/master/src/internal/identifier.js
		// https://qiita.com/m_ando_japan/items/77c96d88a1ab33e980df#state%E3%82%92%E7%94%9F%E6%88%90%E3%81%97%E3%81%A6%E3%83%AA%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%81%AB%E5%90%AB%E3%82%81%E3%82%8B
		// const FORMAT: string = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
		let chars = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.split('');
		for (let i = 0, len = chars.length; i < len; i++) {
			switch (chars[i]) {
				case 'x':
					chars[i] = Math.floor(Math.random() * 16).toString(16);
					break;
				case 'y':
					chars[i] = (Math.floor(Math.random() * 4) + 8).toString(16);
					break;
			}
		}
		return chars.join('');
	};

	const Builddate = function () {
		var dt = new Date();
		var y = dt.getFullYear();
		var m = ('00' + (dt.getMonth() + 1)).slice(-2);
		var d = ('00' + dt.getDate()).slice(-2);
		var result = y + '-' + m + '-' + d;
		return result;
	};

	const Postdeals = function (record) {
		const DeteilData = function (record) {
			let putDetailRecords = [];
			for (let row = 0; row < record.見積明細.value.length; row++) {
				putDetailRecords[row] = {
					tax_code: 129,
					account_item_id: 365746891,
					amount: record.見積明細.value[row].value.小計.value,
				};
			}
			return putDetailRecords;
		};
		const authparams = {
			Authorization: 'Bearer ' + accesstoken,
			'Content-Type': 'application/json',
		};
		const requestbody = {
			issue_date: Builddate(),
			type: 'income',
			company_id: companyid,
			partner_code: record.取引先コード.value,
			details: DeteilData(record),
		};
		kintone.proxy(
			'https://api.freee.co.jp/api/1/deals',
			'POST',
			authparams,
			requestbody,
			function (body, status, headers) {
				let errorString = status;
				const Json = JSON.parse(body);
				switch (status) {
					case 400:
					case 404:
						errorString = status;
						for (let counter = 0; counter < Json.errors.length; counter++) {
							errorString = errorString + '\n' + Json.errors[counter].messages[0];
						}
						alert('error:' + errorString);
						break;
					case 401:
					case 402:
					case 403:
						errorString = status + '\n' + Json.message + '\n' + Json.messages;
						alert('error:' + errorString);
						break;
					case 500:
						alert('Internal Server Error');
						break;
					default:
						alert('freeeへ取引を追加しました。');
						break;
				}
			},
			function (error) {
				alert('freeeへの接続に失敗しました。');
			}
		);
	};

	const GetCompany = function (record) {
		const authparams = {
			Authorization: 'Bearer ' + accesstoken,
		};
		kintone.proxy(
			'https://api.freee.co.jp/api/1/companies',
			'GET',
			authparams,
			{},
			function (body, status, headers) {
				if (status == 200) {
					const respbody = JSON.parse(body);
					if (respbody.companies.length > 0) {
						for (let step = 0; step < respbody.companies.length; step++) {
							if (
								respbody.companies[step].display_name ===
								'APIチームデモアカウント（100名招待可）'
							) {
								//複数事業所に属するアカウントの場合でも強制的にAPIチームデモアカウント（100名招待可）を使用する
								companyid = respbody.companies[step].id;
								Postdeals(record);
							}
						}
					}
				}
			},
			function (error) {
				alert('freeeへの接続に失敗しました。');
			}
		);
	};

	const GetAccessToken = function (callback) {
		const regex = new RegExp('access_token=([^&#]*)');
		const results = regex.exec(window.location.href);
		if (results != null) {
			// 認証を済ませて戻ってきたときに通るステップ
			if (
				window.location.href.split('&state=')[1] ===
					sessionStorage.getItem('statestring') ||
				window.location.href
					.split('&')
					.indexOf('l.state=' + sessionStorage.getItem('statestring')) >= 0
			) {
				sessionStorage.setItem(
					'accesstoken_deal',
					decodeURIComponent(results[1].replace(/\+/g, ' '))
				);
				accesstoken = sessionStorage.getItem('accesstoken_deal');
				callback();
			} else {
				alert('freee上の認証を済ませてください');
			}
		} else {
			if (!sessionStorage.getItem('accesstoken_deal')) {
				//セッションストレージ内にaccesstokenというキーがない場合
				const params = {
					app: kintone.app.getLookupTargetAppId('freee認証'),
					query: 'freee対象アプリ in ("取引作成用") limit 1',
				};
				kintone.api(
					kintone.api.url('/k/v1/records', true),
					'GET',
					params,
					function (resp) {
						//freee認証用アプリに複数行の見積作成用が登録されていても1件しか取得しない。
						const redirecturi =
							kintone.api.url('/k/', true).replace('.json', '') +
							kintone.app.getId() +
							'/'; // freeeへの認証には絶対パスが必要なので一旦この形
						const statestring = GenerateUuid();
						sessionStorage.setItem('statestring', statestring);
						if (resp.records.length > 0) {
							let authurl =
								'https://accounts.secure.freee.co.jp/public_api/authorize?response_type=token';
							authurl += '&client_id=' + resp.records[0].freee_ClientID.value;
							authurl +=
								'&redirect_uri=' + encodeURIComponent(decodeURI(redirecturi));
							authurl += '&state=' + statestring;
							window.location.href = authurl; //ここでリダイレクトします
						} else {
							alert(
								'freee認証用アプリに取引作成用の認証レコードが登録されていません'
							);
						}
					},
					function (error) {
						// エラー
						console.log(error);
					}
				);
			} else {
				accesstoken = sessionStorage.getItem('accesstoken_deal');
				callback();
			}
		}
	};

	let eventslist = ['app.record.detail.process.proceed'];
	kintone.events.on(eventslist, function (event) {
		const nStatus = event.nextStatus.value;
		if (!sessionStorage) {
			alert('ブラウザが古いです');
			return event;
		}
		GetAccessToken(function () {
			if (nStatus === '請求済') {
				GetCompany(event.record);
			}
		});
		return event;
	});
	eventslist = ['app.record.index.show'];
	kintone.events.on(eventslist, function (event) {
		if (!sessionStorage) {
			alert('ブラウザが古いです');
			return event;
		}
		GetAccessToken(function () {
			console.log('初期認証完了');
		});
		return event;
	});
})(jQuery);
