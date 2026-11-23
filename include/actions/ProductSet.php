<?
class CME_ProductSet extends CME_Plugin {
	CONST GROUP = 'GENERAL';
	CONST CODE = 'PRODUCT_SET';
	CONST NAME = 'Создание наборов/комплектов';
	//
	static function GetDescription() {
		$Descr = 'Плагин позволяет собирать наборы и комплекты для выбранных по фильтру товаров.<br/>Если в результате обработки имеются ошибки, смотрите файл лога.';
        $cme = new CME;
		if (!$cme->IsUtf()) {
			$Descr = $cme->ConvertCharset($Descr);
		}
		return $Descr;
	}
	static function GetMessage($Code, $ConvertCharset=false) {
		$MESS = array(
			'SET_TYPE' => 'Набор или комплект:',
			'SET_TYPE_2' => 'набор',
			'SET_TYPE_1' => 'комплект',
			//
			'HEADER_PRODUCT' => 'Товар',
			'HEADER_QUANTITY' => 'Кол-во',
			'HEADER_PERCENT' => 'Процент',
			'HEADER_SORT' => 'Сорт.',
			'HEADER_DELETE' => 'Удал.',
			//
			'ADD_ROW' => 'Добавить товар',
			//
			'EMPTY_MOTICE' => 'Добавьте как минимум один товар.',
			//
			'ALERT_EMPTY_PRODUCTS' => 'Необходимо добавить как минимум один товар в набор/комплект.',
			'ALERT_PERCENT_TOO_MUCH' => 'Сумма процентов не должна превышать 100.',
			'ALERT_QUANTITY_EMPTY' => 'Необходимо указать количества для всех товаров в наборе/комплекте.',
		);
		$MESS = trim($MESS[$Code]);
        $cme = new CME;
		if ($ConvertCharset && !$cme->IsUtf()) {
			$MESS = $cme->ConvertCharset($MESS);
		}
		return $MESS;
	}
	//
	static function AddHeadData() {
		?>
		<script>
		BX.addCustomEvent('onWdaAfterActionChange', function(){
			if(WdaCurrentAction=='<?=self::CODE?>'){
				WDA_<?=self::CODE?>_Fill();
			}
		});
		BX.addCustomEvent('onWdaBeforeSubmit', function(){
			if(WdaCurrentAction!='<?=self::CODE?>') return;
			var products = document.getElementById('wda_product_set_products');
			if (!products) return;
			var visibleRows = Array.from(products.querySelectorAll('table tbody tr')).filter(function(row) {
				return row.getClientRects().length > 0;
			});
			var filledProducts = visibleRows.filter(function(row) {
				var input = row.querySelector('td.product input[type="text"]');
				var id = input ? parseInt(input.value, 10) : NaN;
				return !isNaN(id) && id > 0;
			}).length;
			if (filledProducts === 0) {
				alert('<?=self::GetMessage('ALERT_EMPTY_PRODUCTS',true);?>');
				WdaCanSubmit = false;
			}
			if (WdaCanSubmit !== false) {
				visibleRows.forEach(function(row) {
					var productInput = row.querySelector('td.product input[type="text"]');
					var quantityInput = row.querySelector('td.quantity input[type="text"]');
					if (productInput && productInput.value.length > 0 && (!quantityInput || quantityInput.value.trim().length === 0)) {
						alert('<?=self::GetMessage('ALERT_QUANTITY_EMPTY',true);?>');
						WdaCanSubmit = false;
					}
				});
			}
			if (WdaCanSubmit !== false) {
				var bundleRadio = document.querySelector('#wda_product_set_type input[type="radio"][value="1"]:checked');
				if (bundleRadio) {
					var percent = 0;
					visibleRows.forEach(function(row) {
						var input = row.querySelector('td.percent input[type="text"]');
						if (!input) return;
						var value = parseInt(input.value, 10);
						if (isNaN(value) || value < 0) value = 0;
						percent += value;
					});
					if (percent > 100) {
						alert('<?=self::GetMessage('ALERT_PERCENT_TOO_MUCH',true);?>');
						WdaCanSubmit = false;
					}
				}
			}
		});
		function WDA_<?=self::CODE?>_Fill(){
			var source = document.getElementById('wda_filter_param');
			var target = document.getElementById('wda_price_target');
			if (!source || !target) return;
			target.innerHTML = source.innerHTML;
			target.querySelectorAll('optgroup').forEach(function(group) {
				if (group.getAttribute('data-group') !== 'PRICES') group.remove();
			});
			target.dispatchEvent(new Event('change', { bubbles: true }));
		}
		function WDA_<?=self::CODE?>_RecalculateCount(){
			var products = document.getElementById('wda_product_set_products');
			if (products) products.setAttribute('data-count', products.querySelectorAll('tbody tr').length);
		}
		document.addEventListener('change', function(event) {
			if (!event.target.matches('#wda_product_set_type input[type="radio"]')) return;
			var products = document.getElementById('wda_product_set_products');
			if (!products) return;
			products.classList.remove('type_1', 'type_2');
			products.classList.add('type_' + event.target.value);
		});
		document.addEventListener('click', function(event) {
			var addButton = event.target.closest('#wda_product_set_product_add');
			if (addButton) {
				var body = document.querySelector('#wda_product_set_products tbody');
				var firstRow = body && body.querySelector('tr');
				if (body && firstRow) {
					var newRow = firstRow.cloneNode(true);
					newRow.style.display = '';
					body.appendChild(newRow);
					WDA_<?=self::CODE?>_RecalculateCount();
				}
				return;
			}
			var deleteButton = event.target.closest('#wda_product_set_products tbody td.delete input');
			if (deleteButton) {
				var row = deleteButton.closest('tr');
				if (row) row.remove();
				WDA_<?=self::CODE?>_RecalculateCount();
			}
		});
		function SelectProductPopupCallback(Product, IBlockID){
			var caller = window.SelectProductPopupCaller;
			if (caller && caller.nodeType === 1) {
				var cell = caller.closest('td');
				var input = cell && cell.querySelector('input[type="text"]');
				var name = cell && cell.querySelector('.product_name');
				if (input) input.value = Product.id;
				if (name) name.textContent = Product.name;
			}
			if (window.SelectProductPopup) window.SelectProductPopup.Close();
		}
		function ShowSelectProductPopup(Caller){
			window.SelectProductPopup = new BX.CDialog({
				content_url: '/bitrix/admin/cat_product_search_dialog.php?lang=<?=LANGUAGE_ID;?>&func_name=SelectProductPopupCallback',
				height: Math.max(500, window.innerHeight-400),
				width: Math.max(800, window.innerWidth-400),
				draggable: true,
				resizable: true,
				min_height: 500,
				min_width: 800
			});
			BX.addCustomEvent(window.SelectProductPopup, 'onWindowRegister', BX.defer(function(){
				window.SelectProductPopup.Get().style.position = 'fixed';
				window.SelectProductPopup.Get().style.top = (parseInt(window.SelectProductPopup.Get().style.top, 10) - BX.GetWindowScrollPos().scrollTop) + 'px';
			}));
			window.SelectProductPopupCaller = Caller;
			window.SelectProductPopup.Show();
		}
		</script>
		<style>
		#wda_product_set_type input[type=radio] {margin:0 0 0 5px; vertical-align:middle;}
		#wda_product_set_type span {vertical-align:middle;}
		#wda_product_set_products th {min-width:100px;}
		#wda_product_set_products.type_2 .percent {display:none;}
		#wda_product_set_products .empty_notice {color:dimgray; display:none; font-size:12px; font-style:italic; padding:10px;}
		#wda_product_set_products[data-count="0"] .empty_notice {display:block; }
		#wda_product_set_products tbody td.delete {width:36px;}
		#wda_product_set_products tbody td input[type=text] {width:100%; -moz-box-sizing:border-box; -webkit-box-sizing:border-box; box-sizing:border-box;}
		#wda_product_set_products tbody td .product_name {color:dimgray; font-size:12px; font-style:italic; margin-top:4px; text-align:left;}
		#wda_product_set_products tbody td .product_flex {display:flex;}
		#wda_product_set_products tbody td .product_flex input[type=text] {margin-right:10px;}
		#wda_product_set_products tbody td .product_flex input[type=button] {margin-top:-2px;}
		</style>
		<?
	}
	static function ShowSettings($IBlockID=false) {
		?>
		<div id="wda_settings_<?=self::CODE?>">
			<div id="wda_product_set_type">
				<?=self::GetMessage('SET_TYPE');?>
				<label><input type="radio" name="params[set_type]" value="2" checked="checked" /> <span><?=self::GetMessage('SET_TYPE_2');?></span></label>
				<label><input type="radio" name="params[set_type]" value="1" /> <span><?=self::GetMessage('SET_TYPE_1');?></span></label>
			</div>
			<br/>
			<div id="wda_product_set_products" class="type_2" data-count=0>
				<div class="products">
					<div class="adm-list-table-wrap">
						<table class="adm-list-table">
							<thead>
								<tr class="adm-list-table-header">
									<td class="adm-list-table-cell product"><div class="adm-list-table-cell-inner"><?=self::GetMessage('HEADER_PRODUCT');?></div></td>
									<td class="adm-list-table-cell quantity"><div class="adm-list-table-cell-inner"><?=self::GetMessage('HEADER_QUANTITY');?></div></td>
									<td class="adm-list-table-cell sort"><div class="adm-list-table-cell-inner"><?=self::GetMessage('HEADER_SORT');?></div></td>
									<td class="adm-list-table-cell percent"><div class="adm-list-table-cell-inner"><?=self::GetMessage('HEADER_PERCENT');?></div></td>
									<td class="adm-list-table-cell delete"><div class="adm-list-table-cell-inner"><?=self::GetMessage('HEADER_DELETE');?></div></td>
								</tr>
							</thead>
							<tbody>
								<tr class="adm-list-table-row" style="display:none">
									<td class="adm-list-table-cell align-right product">
										<div class="product_flex">
											<input type="text" name="params[products][id][]" value="" size="10" maxlength="10" />
											<input type="button" value="..." class="select_product" onclick="ShowSelectProductPopup(this);" />
										</div>
										<div class="product_name"></div>
									</td>
									<td class="adm-list-table-cell align-right quantity"><input type="text" name="params[products][quantity][]" value="1" size="10" maxlength="10" /></td>
									<td class="adm-list-table-cell align-right sort"><input type="text" name="params[products][sort][]" value="100" size="10" maxlength="10" /></td>
									<td class="adm-list-table-cell align-right percent"><input type="text" name="params[products][percent][]" value="" size="10" maxlength="3" /></td>
									<td class="adm-list-table-cell align-right delete"><input type="button" value="&times;" /></td>
								</tr>
							</tbody>
						</table>
						<div class="empty_notice"><?=self::GetMessage('EMPTY_NOTICE');?></div>
					</div>
				</div>
				<br/>
				<input type="button" value="<?=self::GetMessage('ADD_ROW');?>" id="wda_product_set_product_add" />
			</div>
		</div>
		<?
	}
	static function Process($ElementID, $arElement, $Params) {
		$bResult = false;
        $cme = new CME;
		if(CModule::IncludeModule('catalog') && class_exists('CCatalogProductSet') && is_array($Params['products']) && !empty($Params['products'])) {
			$intType = $Params['set_type']==1 ? CCatalogProductSet::TYPE_SET : CCatalogProductSet::TYPE_GROUP;
			//
			$arSetItems = array();
			foreach($Params['products']['id'] as $ProductIndex => $ID){
				$ID = IntVal($ID);
				if($ID===0) {
					continue;
				}
				$arSetItem = array(
					'ACTIVE' => 'Y',
					'ITEM_ID' => $ID,
					'QUANTITY' => $Params['products']['quantity'][$ProductIndex],
					'SORT' => $Params['products']['sort'][$ProductIndex],
				);
				if($intType==CCatalogProductSet::TYPE_SET) {
					$arSetItem['DISCOUNT_PERCENT'] = $Params['products']['percent'][$ProductIndex];
				}
				$arSetItems[] = $arSetItem;
			}
			$arSetFields = array(
				'TYPE' => $intType,
				'SET_ID' => 0,
				'ITEM_ID' => $ElementID,
				'ITEMS' => $arSetItems,
			);
			//
			$arProductSets = CCatalogProductSet::getAllSetsByProduct($ElementID, $intType);
			//
			$obCatalogProductSet = new CCatalogProductSet;
			//
			if(is_array($arProductSets) && !empty($arProductSets)) {
				$arProductSets = array_shift($arProductSets);
				unset($arSetFields['SET_ID'], $arSetFields['ITEM_ID'], $arSetFields['TYPE']);
				if($obCatalogProductSet->Update($arProductSets['SET_ID'], $arSetFields)) {
					$obCatalogProductSet->RecalculateSetsByProduct($ElementID);
					$bResult = true;
				} else {
                    $cme->Log('Errors for element #'.$ElementID.' (update mode)');
                    $cme->Log($obCatalogProductSet->getErrors());
				}
			} else {
				$arSetFields['ACTIVE'] = 'Y';
				$obCatalogProductSet = new CCatalogProductSet;
				if ($obCatalogProductSet->Add($arSetFields)) {
					$bResult = true;
				} else {
                    $cme->Log('Errors for element #'.$ElementID.' (add mode)');
                    $cme->Log($obCatalogProductSet->getErrors());
				}
			}
		}
		return $bResult;
	}
}
?>