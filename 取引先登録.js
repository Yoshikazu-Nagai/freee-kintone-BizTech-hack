/* eslint-disable linebreak-style */
/* eslint-disable quotes */
/*
 * プログラム名：取引先登録
 * サブドメイン：fk-biztech
 * 内容説明：・レコード一覧画面が表示されたら発動し、freeeアプリへアクセストークンを取得するOauth経由のリクエストを送信。
 *            アクセストークンの取得の際に使用するclient_idはfreee認証用アプリからレコードを取得し、そのフィールドの値を使用する。
 *          ・レコード詳細画面でヘッダスペースに表示された文字列がクリックされると発動する。
 *          　freeeアプリへOAuth経由でアクセストークンを確認し、
 *          　stateのパラメータとともに整合性を確認できた場合、
 *          　freee APIのcompaniesエンドポイントから事業所を取得する。表示名が「APIチームデモアカウント（100名招待可）」の事業所IDを取得する。
 *          　freee APIのpartnersエンドポイントから取引先をkintoneの「レコード番号」フィールドを基を取得する。
 *          　もしfreee APIに存在する場合(codeがkintoneの「取引先コード」フィールドと等しい場合)はPUTで更新する。更新フィールドはデモ環境なので会社名のみ。
 *          　もしfreee APIに存在しない場合はPOSTで追加する。codeにkintoneの「取引先コード」フィールドを設定する。
 * 対象アプリ：取引先リスト(freee & kintone BizTech hack) アプリID：変動
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

	const PostPartner = function (record) {
		const authparams = {
			Authorization: 'Bearer ' + accesstoken,
			'Content-Type': 'application/json',
		};
		const requestbody = {
			company_id: companyid,
			name: record.会社名.value,
			code: record.取引先コード.value,
		};
		kintone.proxy(
			'https://api.freee.co.jp/api/1/partners',
			'POST',
			authparams,
			requestbody,
			function (body, status, headers) {
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
						alert('freeeへ取引先を追加しました。');
						break;
				}
			},
			function (error) {
				alert('freeeへの接続に失敗しました。');
			}
		);
	};

	const PutPartner = function (record, id) {
		const authparams = {
			Authorization: 'Bearer ' + accesstoken,
			'Content-Type': 'application/json',
		};
		const requestbody = {
			company_id: companyid,
			name: record.会社名.value,
		};
		kintone.proxy(
			'https://api.freee.co.jp/api/1/partners/' + id,
			'PUT',
			authparams,
			requestbody,
			function (body, status, headers) {
				switch (status) {
					case 400:
					case 401:
					case 402:
						alert('error:' + status);
						break;
					case 403:
						alert('error:403(このアプリケーションにはアクセス権限がないエンドポイントです)');
						break;
					case 404:
						alert('error:' + status);
						break;
					case 500:
						alert('Internal Server Error');
						break;
					default:
						alert('freeeへ取引先を更新しました。');
						break;
				}
			},
			function (error) {
				alert('freeeへの接続に失敗しました。');
			}
		);
	};

	const GetPartner = function (record) {
		const authparams = {
			Authorization: 'Bearer ' + accesstoken,
		};
		const querybody = {};
		kintone.proxy(
			'https://api.freee.co.jp/api/1/partners?id=' +
				record.取引先コード.value +
				'&company_id=' +
				companyid,
			'GET',
			authparams,
			querybody,
			function (body, status, headers) {
				if (status == 200) {
					const respbody = JSON.parse(body);
					if (respbody.partners.length > 0) {
						let flg = false;
						for (let step = 0; step < respbody.partners.length; step++) {
							if (respbody.partners[step].code === record.取引先コード.value) {
								flg = true;
								PutPartner(record, respbody.partners[step].id);
							}
						}
						if (!flg) {
							PostPartner(record);
						}
					} else {
						PostPartner(record);
					}
				}
			},
			function (error) {
				alert('freeeへの接続に失敗しました。');
			}
		);
	};

	const GetCompany = function (record) {
		const headerspace = kintone.app.record.getHeaderMenuSpaceElement();
		const clickbutton = document.createElement('button');
		clickbutton.textContent = '取引先の作成';
		clickbutton.onclick = function () {
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
									GetPartner(record);
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
		headerspace.appendChild(clickbutton);
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
					'accesstoken',
					decodeURIComponent(results[1].replace(/\+/g, ' '))
				);
				accesstoken = sessionStorage.getItem('accesstoken');
				callback();
			} else {
				alert('freee上の認証を済ませてください');
			}
		} else {
			if (!sessionStorage.getItem('accesstoken')) {
				//セッションストレージ内にaccesstokenというキーがない場合
				const params = {
					app: kintone.app.getLookupTargetAppId('freee認証'),
					query: 'freee対象アプリ in ("取引先作成用") limit 1',
				};
				kintone.api(
					kintone.api.url('/k/v1/records', true),
					'GET',
					params,
					function (resp) {
						//freee認証用アプリに複数行の取引先作成用が登録されていても1件しか取得しない。
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
								'freee認証用アプリに取引先作成用の認証レコードが登録されていません'
							);
						}
					},
					function (error) {
						// エラー
						console.log(error);
					}
				);
			} else {
				accesstoken = sessionStorage.getItem('accesstoken');
				callback();
			}
		}
	};

	let eventslist = ['app.record.detail.show'];
	kintone.events.on(eventslist, function (event) {
		if (!sessionStorage) {
			alert('ブラウザが古いです');
			return event;
		}
		GetAccessToken(function () {
			GetCompany(event.record);
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
