<?
class CWDA_ImageDelete extends CWDA_Plugin {
	CONST GROUP = 'IMAGES';
	CONST CODE = 'IMAGE_DELETE';
	CONST NAME = 'Удаление изображений, файлов';
	//
	static function GetDescription() {
		$Descr = 'Плагин для удаления изображений и файлов из полей и свойств элементов инфоблоков.';
        $cwda = new CWDA;
		if (!$cwda->IsUtf()) {
			$Descr = $cwda->ConvertCharset($Descr);
		}
		return $Descr;
	}
	static function GetMessage($Code, $ConvertCharset=false) {
		$MESS = array(
			'PROP_GROUP_1' => 'Поле, свойство',
			//
			'ALERT_NO_SOURCE' => 'Укажите в каком поле/свойстве нужно удалить изображение или файл.',
		);
		$MESS = trim($MESS[$Code]);
        $cwda = new CWDA;
		if ($ConvertCharset && !$cwda->IsUtf()) {
			$MESS = $cwda->ConvertCharset($MESS);
		}
		return $MESS;
	}
	//
	static function AddHeadData() {
		?>
		<script>
		BX.addCustomEvent('onWdaAfterIBlockChange', function(){
			if(WdaCurrentAction=='<?=self::CODE?>'){
				WDA_<?=self::CODE?>_Fill();
			}
		});
		BX.addCustomEvent('onWdaAfterActionChange', function(){
			if(WdaCurrentAction=='<?=self::CODE?>'){
				WDA_<?=self::CODE?>_Fill();
			}
		});
		BX.addCustomEvent('onWdaBeforeSubmit', function(){
			if(WdaCurrentAction=='<?=self::CODE?>'){
				var sourceSelect = document.getElementById('wda_field_source');
				if (!sourceSelect || sourceSelect.selectedOptions.length === 0) {
					WdaCanSubmit = false;
					alert('<?=self::GetMessage('ALERT_NO_SOURCE',true);?>');
				}
			}
		});
		//
		function WDA_<?=self::CODE?>_Fill(){
			var source = document.getElementById('wda_filter_param');
			var target = document.getElementById('wda_field_source');
			if (!source || !target) {
				return;
			}
			target.innerHTML = source.innerHTML;
			var emptyOption = target.querySelector('option[value=""]');
			if (emptyOption) {
				emptyOption.remove();
			}
			target.querySelectorAll('optgroup').forEach(function(group) {
				if (['FIELDS', 'PROPERTIES'].indexOf(group.getAttribute('data-group')) === -1) {
					group.remove();
				}
			});
			target.querySelectorAll('optgroup option').forEach(function(option) {
				if (option.getAttribute('data-type') !== 'F') {
					option.remove();
				}
			});
			target.dispatchEvent(new Event('change', { bubbles: true }));
		}
		//
		</script>
		<?
	}
	static function ShowSettings($IBlockID=false) {
        $cwda = new CWDA;
		?>
		<div id="wda_settings_<?=self::CODE?>">
			<div class="wda_settings_header"><?=self::GetMessage('PROP_GROUP_1');?></div>
			<div>
				<div><select name="params[field_source][]" id="wda_field_source" class="wda_select_field" multiple="multiple" size="8"></select><?=$cwda->ShowHint(self::GetMessage('SELECT_SOURCE_PRICE'));?></div>
			</div>
			<br/>
		</div>
		<?
	}
	static function Process($ElementID, $arElement, $Params) {
		$bResult = false;
		if(is_array($Params['field_source'])) {
			$IBlockElement = new CIBlockElement;
			foreach($Params['field_source'] as $Field){
				$arFields = array();
				if($Field=='PREVIEW_PICTURE') {
					$arFields['PREVIEW_PICTURE'] = array('del'=>'Y');
				} elseif($Field=='DETAIL_PICTURE') {
					$arFields['DETAIL_PICTURE'] = array('del'=>'Y');
				} elseif(preg_match('#^PROPERTY_(\d+)$#i',$Field,$M)) {
					CIBlockElement::SetPropertyValuesEx($ElementID,$arElement['IBLOCK_ID'],array($M[1]=>array('del'=>'Y')));
				}
				if(!empty($arFields)) {
					$IBlockElement->Update($ElementID,$arFields);
				}
				$bResult = true;
			}
		}
		return $bResult;
	}
}
?>