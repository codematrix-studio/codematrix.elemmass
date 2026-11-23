<?
class CME_ImageCopy extends CME_Plugin {
	CONST GROUP = 'IMAGES';
	CONST CODE = 'IMAGE_COPY';
	CONST NAME = 'Копирование изображений';
	//
	static function GetDescription() {
		$Descr = 'Плагин для копирования изображений в инфоблоках из одного поля/свойства в другое. Поддерживаются поля «Картинка для анонса» и «Детальная картинка», а также свойства инфоблока типа «Файл». Возможны любые сочетания.';
        $cwda = new CWDA;
		if (!$cwda->IsUtf()) {
			$Descr = $cwda->ConvertCharset($Descr);
		}
		return $Descr;
	}
	static function GetMessage($Code, $ConvertCharset=false) {
		$MESS = array(
			'PROP_GROUP_1' => 'Откуда',
			'PROP_GROUP_2' => 'Куда',
			//
			'ALERT_NO_SOURCE' => 'Укажите, откуда скопировать изображения',
			'ALERT_NO_TARGET' => 'Укажите, куда скопировать изображения',
			'ALERT_TARGET_EQUAL_SOURCE' => 'Поля «Откуда» и «Куда» не могут совпадать',
			//
			'SELECT_SOURCE' => 'Выберите поле/свойство с изображением.',
			'SELECT_TARGET' => 'Выберите поле/свойство, куда будет сохраняться изображение.',
		);
        $cwda = new CWDA;
		$MESS = trim($MESS[$Code]);
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
				var sourceValue = document.getElementById('wda_field_source');
				var targetValue = document.getElementById('wda_field_target');
				if (!sourceValue || sourceValue.value === '') {
					WdaCanSubmit = false;
					alert('<?=self::GetMessage('ALERT_NO_SOURCE',true);?>');
				} else if (!targetValue || targetValue.value === '') {
					WdaCanSubmit = false;
					alert('<?=self::GetMessage('ALERT_NO_TARGET',true);?>');
				} else if (sourceValue.value === targetValue.value) {
					WdaCanSubmit = false;
					alert('<?=self::GetMessage('ALERT_TARGET_EQUAL_SOURCE',true);?>');
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
			target.querySelectorAll('optgroup').forEach(function(group) {
				if (["FIELDS","PROPERTIES"].indexOf(group.getAttribute('data-group')) === -1) {
					group.remove();
				}
			});
			target.querySelectorAll('optgroup option').forEach(function(option) {
				if (option.getAttribute('data-type') !== 'F') {
					option.remove();
				}
			});
			target.dispatchEvent(new Event('change', { bubbles: true }));
			var source = document.getElementById('wda_filter_param');
			var target = document.getElementById('wda_field_target');
			if (!source || !target) {
				return;
			}
			target.innerHTML = source.innerHTML;
			target.querySelectorAll('optgroup').forEach(function(group) {
				if (["FIELDS","PROPERTIES"].indexOf(group.getAttribute('data-group')) === -1) {
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
				<div><select name="params[field_source]" id="wda_field_source" class="wda_select_field"></select><?=$cwda->ShowHint(self::GetMessage('SELECT_SOURCE'));?></div>
			</div>
			<br/>
			<div class="wda_settings_header"><?=self::GetMessage('PROP_GROUP_2');?></div>
			<div>
				<div><select name="params[field_target]" id="wda_field_target" class="wda_select_field"></select><?=$cwda->ShowHint(self::GetMessage('SELECT_TARGET'));?></div>
			</div>
		</div>
		<?
	}
	static function Process($ElementID, $arElement, $Params) {
        $cwda = new CWDA;
		$bResult = false;
		// Source
		$SourceField = false;
		if(in_array($Params['field_source'],array('PREVIEW_PICTURE','DETAIL_PICTURE'))) {
			$SourceField = $Params['field_source'];
		}
		$SourcePropertyID = false;
		if(preg_match('#^PROPERTY_(\d+)$#i',$Params['field_source'],$M)) {
			$SourcePropertyID = IntVal($M[1]);
		}
		// Target
		$TargetField = false;
		if(in_array($Params['field_target'],array('PREVIEW_PICTURE','DETAIL_PICTURE'))) {
			$TargetField = $Params['field_target'];
		}
		$TargetPropertyID = false;
		if(preg_match('#^PROPERTY_(\d+)$#i',$Params['field_target'],$M)) {
			$TargetPropertyID = IntVal($M[1]);
		}
		// Process
		if ((strlen($SourceField) || $SourcePropertyID>0) && (strlen($TargetField) || $TargetPropertyID>0)) {
			$Value = false;
			if (strlen($SourceField)) {
				$Value = $arElement[$SourceField];
			} elseif ($SourcePropertyID>0) {
				$arProp = $cwda->GetPropertyFromArrayById($arElement['PROPERTIES'],$SourcePropertyID);
				$Value = $arProp['VALUE'];
			}
			if (!empty($Value)) {
				if (strlen($TargetField)) {
					if (is_array($Value)) {
						$Value = $Value[0];
					}
					if ($Value>0) {
						$Value = CFile::MakeFileArray($Value);
						$IBlockElement = new CIBlockElement;
						if ($IBlockElement->Update($arElement['ID'],array($TargetField=>$Value))) {
                            $cwda->Log('Copy image for element #'.$arElement['ID'].' (from '.$Params['field_source'].' to '.$Params['field_target'].')', self::CODE);
							$bResult = true;
						} else {
                            $cwda->Log('Error while copy image for element #'.$arElement['ID'].': '.$IBlockElement->LAST_ERROR, self::CODE);
						}
					}
				} elseif ($TargetPropertyID>0) {
					$arProp = $cwda->GetPropertyFromArrayById($arElement['PROPERTIES'],$TargetPropertyID);
					if ($arProp['MULTIPLE']!='Y' && is_array($Value)) {
						$Value = $Value[0];
						$Value = CFile::MakeFileArray($Value);
					} elseif ($arProp['MULTIPLE']=='Y' && is_array($Value)) {
						foreach($Value as $Key => $FileID){
							$Value[$Key] = CFile::MakeFileArray($FileID);
						}
					} elseif ($Value>0) {
						$Value = CFile::MakeFileArray($Value);
					}
					CIBlockElement::SetPropertyValuesEx($arElement['ID'],$arElement['IBLOCK_ID'],array($TargetPropertyID=>$Value));
                    $cwda->Log('Copy image for element #'.$arElement['ID'].' (from '.$Params['field_source'].' to '.$Params['field_target'].')', self::CODE);
					$bResult = true;
				}
			}
		}
		return $bResult;
	}
}
?>