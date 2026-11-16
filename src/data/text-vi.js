// data/text-vi.js — Vietnamese player-facing labels: time of day, difficulty, stage tags, biome & shop-category names

export const TOD_LABEL = { day:'BUỔI SÁNG', noon:'GIỮA TRƯA', sunset:'HOÀNG HÔN', night:'BAN ĐÊM' }; // coins / score payout
// player-chosen DIFFICULTY (RECRUIT/SOLDIER/VETERAN) — scales enemy HP/damage + reward, on top of loop & contract
export const DIFF_META = { recruit:{label:'TÂN BINH',tag:'DỄ'}, soldier:{label:'CHIẾN SĨ',tag:'THƯỜNG'}, veteran:{label:'LÃO LUYỆN',tag:'KHÓ'} };
export const STAGE_TAGS=['CHUẨN BỊ ĐÓN ĐÁNH','VÒNG VÂY SIẾT CHẶT','KHÔNG LÙI BƯỚC','LAO VÀO BÃO LỬA','TRẬN CUỐI CÙNG'];
export const BIOME_VI={ DESERT:'SA MẠC', RUINS:'PHẾ TÍCH', TUNDRA:'BĂNG GIÁ', FOUNDRY:'LÒ ĐÚC', CITADEL:'THÀNH LUỸ', MEADOW:'THẢO NGUYÊN', CITY:'THÀNH PHỐ', HILLS:'ĐỒI NÚI', VILLAGE:'LÀNG QUÊ SÔNG SUỐI', SAVANNA:'XAVAN CHÂU PHI', ARCTIC:'BẮC CỰC' };
export const CAT_VI={ WEAPONS:'VŨ KHÍ', FIREPOWER:'HOẢ LỰC', AMMO:'ĐẠN DƯỢC', CHASSIS:'THÂN XE', SUPPORT:'HỖ TRỢ' };
// Z170 every battlefield is a real, famous place in the land its terrain belongs to: where it is, and what its strongholds are called
export const BIOME_PLACE={
  DESERT:{ at:'GIZA · AI CẬP', forts:['LUXOR','KARNAK','ABU SIMBEL','ASWAN','SIWA','EL ALAMEIN','SAQQARA','DAHSHUR','MEMPHIS','THUNG LŨNG CÁC VUA'] },
  SAVANNA:{ at:'DJENNÉ · MALI', forts:['TIMBUKTU','MOPTI','GAO','SÉGOU','BANDIAGARA','SANGHA','HOMBORI','KAYES'] },
  TUNDRA:{ at:'MOSKVA · NGA', forts:['NOVGOROD','PSKOV','SUZDAL','VLADIMIR','YAROSLAVL','KOSTROMA','SMOLENSK','KAZAN'] },
  FOUNDRY:{ at:'VÖLKLINGEN · ĐỨC', forts:['ESSEN','DORTMUND','DUISBURG','BOCHUM','GELSENKIRCHEN','OBERHAUSEN','SAARBRÜCKEN','ZOLLVEREIN'] },
  CITADEL:{ at:'AGRA · ẤN ĐỘ', forts:['AGRA','AMBER','MEHRANGARH','JAISALMER','CHITTORGARH','KUMBHALGARH','GWALIOR','RANTHAMBORE'] },
  MEADOW:{ at:'KINDERDIJK · HÀ LAN', forts:['KINDERDIJK','ZAANSE SCHANS','HAARLEM','DELFT','LEIDEN','GOUDA','NAARDEN','BOURTANGE'] },
  CITY:{ at:'TP. HỒ CHÍ MINH · VIỆT NAM', forts:['BẾN THÀNH','CHỢ LỚN','THỦ THIÊM','BẾN NGHÉ','TÂN ĐỊNH','PHÚ MỸ HƯNG','GIA ĐỊNH','THẢO ĐIỀN'] },
  HILLS:{ at:'BẮC KINH · TRUNG QUỐC', forts:['BÁT ĐẠT LĨNH','MỘ ĐIỀN DỤC','KIM SƠN LĨNH','TƯ MÃ ĐÀI','CƯ DUNG QUAN','SƠN HẢI QUAN','GIA DỤC QUAN','HOÀNG NHAI QUAN'] },
  VILLAGE:{ at:'HÀ NỘI · VIỆT NAM', forts:['CỔ LOA','SƠN TÂY','ĐƯỜNG LÂM','BÁT TRÀNG','HƯƠNG SƠN','VẠN PHÚC','PHÙ ĐỔNG','BA VÌ'] },
  RUINS:{ at:'ROMA · Ý', forts:['PALATINO','FORUM ROMANUM','CASTEL SANT\'ANGELO','OSTIA ANTICA','APPIA ANTICA','TIVOLI','CARACALLA','POMPEII'] },
  ARCTIC:{ at:'NUNAVUT · CANADA', forts:['IQALUIT','RESOLUTE','POND INLET','ARCTIC BAY','GRISE FIORD','CAMBRIDGE BAY','ALERT','EUREKA'] },
};
// Z181 one line that sells each battlefield (battle setup hero card)
export const BIOME_BLURB={
  DESERT:'Cồn cát bỏng rát dưới bóng kim tự tháp — tầm nhìn xa tít, gần như không có chỗ nấp.',
  RUINS:'Đế chế đổ nát giữa lòng Roma — cột đá, tường vỡ, giao tranh ở cự li sát sườn.',
  TUNDRA:'Thảo nguyên băng giá ngoại ô Moskva — đất trơn, gió buốt, quân địch ẩn trong tuyết.',
  FOUNDRY:'Khu luyện thép Völklingen — lò cao, ống khói và khói xỉ che khuất tầm ngắm.',
  CITADEL:'Thành luỹ sa thạch xứ Agra — tường cao, cổng sắt, tướng địch cố thủ đến cùng.',
  MEADOW:'Đồng cỏ cối xay gió Kinderdijk — thoáng đãng, cơ động, đọ pháo tầm xa.',
  CITY:'Phố thị Sài Gòn — cao ốc, ngã tư chật hẹp, mỗi góc phố là một ổ phục kích.',
  HILLS:'Dãy đồi Vạn Lý Trường Thành — dốc cao, ai chiếm điểm cao người đó thắng.',
  VILLAGE:'Làng quê sông nước Bắc Bộ — ruộng lúa, cầu tre, luỹ tre làng che chắn.',
  SAVANNA:'Xavan khô hạn Tây Phi — cỏ vàng, cây bao báp và những đồn đất nung.',
  ARCTIC:'Băng nguyên Nunavut — trắng xoá, khe nứt băng, gấu trắng rình rập.',
};
export function biomeBlurb(name){ return BIOME_BLURB[name]||''; }
export function biomePlace(name){ return BIOME_PLACE[name] ? BIOME_PLACE[name].at : ''; }
