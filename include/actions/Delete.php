<?
class CME_Delete extends CME_Plugin {
	CONST GROUP = 'GENERAL';
	CONST CODE = 'DELETE';
	CONST NAME = 'Удаление элементов';
	//
	static function GetDescription() {
		$Descr = 'Плагин для удаления элементов инфоблока.';
        $cme = new CME;
		if (!$cme->IsUtf()) {
			$Descr = $cme->ConvertCharset($Descr);
		}
		return $Descr;
	}
	static function AddHeadData() {
		//
	}
	static function ShowSettings($IBlockID=false) {
	}
	static function Process($ElementID, $arElement, $Params) {
		$bResult = false;
        $cme = new CME;
		if(CIBlockElement::Delete($ElementID)) {
            $cme->Log('Delete element #'.$ElementID, self::CODE);
			$bResult = true;
		}
		return $bResult;
	}
}
?>