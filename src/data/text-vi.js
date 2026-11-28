// data/text-vi.js — Vietnamese player-facing labels: time of day, difficulty, stage tags, biome & shop-category names

export const TOD_LABEL = { day:'BUỔI SÁNG', noon:'GIỮA TRƯA', sunset:'HOÀNG HÔN', night:'BAN ĐÊM' }; // coins / score payout
// player-chosen DIFFICULTY (RECRUIT/SOLDIER/VETERAN) — scales enemy HP/damage + reward, on top of loop & contract
export const DIFF_META = { recruit:{label:'TÂN BINH',tag:'DỄ'}, soldier:{label:'CHIẾN SĨ',tag:'THƯỜNG'}, veteran:{label:'LÃO LUYỆN',tag:'KHÓ'} };
export const STAGE_TAGS=['CHUẨN BỊ ĐÓN ĐÁNH','VÒNG VÂY SIẾT CHẶT','KHÔNG LÙI BƯỚC','LAO VÀO BÃO LỬA','TRẬN CUỐI CÙNG'];
export const BIOME_VI={ DESERT:'SA MẠC', RUINS:'PHẾ TÍCH', TUNDRA:'BĂNG GIÁ', FOUNDRY:'LÒ ĐÚC', CITADEL:'THÀNH LUỸ', MEADOW:'THẢO NGUYÊN', CITY:'THÀNH PHỐ', HILLS:'ĐỒI NÚI', VILLAGE:'LÀNG QUÊ SÔNG SUỐI', SAVANNA:'XAVAN ĐẤT ĐỎ', ARCTIC:'BẮC CỰC' , STEELMILL:'NHÀ MÁY THÉP BỎ HOANG', VOLCANO:'CHẢO NÚI LỬA', QUARRY:'MỎ ĐÁ THẠCH CAO', CAVERN:'HANG NGẦM' };
// NAMES 1 (was Z170: real landmarks) every battlefield is an INVENTED place, never a real city, country or monument — HUDUX 4 all in one voice, Vietnamese
//   (Hán-Việt or plain descriptive, like the forts of the conquest: Thành Cát Đỏ…), no more Egyptian / German / Latin / Indian-sounding mixes
//   (style per biome: DOCS "NAMES 1"; config NAMES.banned is the list test.js keeps out of every player-visible text)
export const BIOME_PLACE={
  DESERT:{ at:'XÍCH SA · XỨ CÁT ĐỎ', forts:['CỒN GIÓ HÚ','GIẾNG KHÔ','SA LĨNH','ỐC ĐẢO CHÀ LÀ','THÁP ĐÁ CỔ','NANH CÁT','HẺM BÃO CÁT','ĐỒI XƯƠNG TRẮNG','MỘ VUA CÁT','THUNG LŨNG MỘ ĐÁ'] },
  SAVANNA:{ at:'HOÀNG THẢO · MIỀN ĐẤT ĐỎ', forts:['GÒ BAO BÁP','BÃI CỎ CHÁY','SUỐI KHÔ','ĐỒI MỐI','BẾN TRÂU RỪNG','GÒ ĐẤT NUNG','TRẢNG SƯ TỬ','CÂY ĐA CÔ ĐỘC'] },
  TUNDRA:{ at:'BẠCH NGUYÊN · XỨ TUYẾT TRẮNG', forts:['LŨNG GIÓ BUỐT','TRẠM SƯƠNG GIÁ','ĐỒI TUYẾT ĐỌNG','HỒ BĂNG MỎNG','RỪNG THÔNG LẠNH','BẾN XE TRƯỢT','GÒ BÃO TUYẾT','TRẠM KHÍ TƯỢNG'] },
  FOUNDRY:{ at:'THIẾT LÔ · VÙNG LÒ THAN', forts:['LÒ CAO SỐ MỘT','BÃI XỈ THAN','XƯỞNG ĐÚC CŨ','ỐNG KHÓI ĐÔI','KHO QUẶNG','CẦU TRỤC','LÒ LUYỆN CỐC','GA THAN'] },
  CITADEL:{ at:'XÍCH THẠCH · MIỀN SA THẠCH', forts:['CỔNG VOI ĐÁ','THÀNH NỘI ĐỔ','THÁP CANH ĐỎ','LẦU BÁT GIÁC','HÀO CẠN','SÂN ĐÁ ONG','VỌNG LÂU','KHO LƯƠNG CŨ'] },
  MEADOW:{ at:'PHONG XA · VÙNG ĐẤT TRŨNG', forts:['CỐI XAY GIÓ','ĐÊ BAO','KÊNH ĐÀO','TRẠI BÒ SỮA','CẦU GỖ','ĐỒNG HOA','KHO CỎ KHÔ','CỐNG NƯỚC'] },
  CITY:{ at:'ĐÔ THỊ HẢI ĐĂNG · VÙNG DUYÊN HẢI', forts:['CHỢ TRUNG TÂM','KHU CẢNG CŨ','BÁN ĐẢO MỚI','BẾN PHÀ','KHU PHỐ CỔ','ĐẠI LỘ KÍNH','KHU CÔNG VIÊN','KHU BIỆT THỰ VEN SÔNG'] },
  HILLS:{ at:'THANH LĨNH · MIỀN ĐỒI ĐÁ', forts:['VÂN TIÊU QUAN','HẮC PHONG LĨNH','THIẾT BÍCH QUAN','LONG BỐI LĨNH','BẠCH THẠCH ĐÀI','PHONG HOẢ ĐÀI','NGỌC TRỤ QUAN','THANH VÂN LĨNH'] },
  VILLAGE:{ at:'XÓM BÃI BỒI · VÙNG QUÊ SÔNG NƯỚC', forts:['ĐÌNH LÀNG CŨ','BẾN ĐÒ','GÒ ĐẤT ĐỎ','XÓM LÒ GỐM','CỔNG LÀNG','ĐỒI CHÈ','BÃI NGÔ','RUỘNG BẬC THANG'] },
  RUINS:{ at:'CỔ ĐÔ TRO TÀN · MIỀN PHẾ ĐÔ', forts:['TƯỜNG TRO','THÁP RỪNG','LUỸ SÓI','QUẢNG TRƯỜNG LẶNG','LÂU ĐÀI BÓNG','ĐƯỜNG ĐÁ CỔ','NHÀ TẮM CỔ','CẦU DẪN NƯỚC GÃY'] },
  ARCTIC:{ at:'BĂNG NGUYÊN BẮC PHONG · VÙNG CỰC BẮC', forts:['TRẠM CỰC QUANG','VỊNH BĂNG XANH','MŨI GIÓ BẤC','ĐỈNH SƯƠNG MUỐI','CẢNG HẢI CẨU','GÒ GẤU TRẮNG','HẺM BĂNG','TRẠM BÃO TUYẾT'] },
  STEELMILL:{ at:'THIẾT CỐC · THUNG LŨNG RỈ SÉT', forts:['LÒ NGUỘI','CẢNG XỈ','ĐỒI LÒ RÈN','SUỐI GỈ','DỐC THAN CỐC','BẾN LÒ NỔ','XƯỞNG NUNG','BÃI LUYỆN'] },
  VOLCANO:{ at:'HOẢ SƠN XÍCH NHAM · ĐẢO ĐÁ ĐEN', forts:['MIỆNG LỬA','SƯỜN BAZAN','HỒ DUNG NHAM','ĐÈO TRO BỤI','GHỀNH ĐÁ ĐEN','MŨI LƯU HUỲNH','HANG KHÓI','BÃI XỈ ĐỎ'] },
  QUARRY:{ at:'BẠCH SƠN · DÃY NÚI ĐÁ TRẮNG', forts:['MỎ TRẮNG','VÁCH ĐÁ HOA','THUNG ĐỤC ĐÁ','CẦU MẢNH ĐÁ','NÚI BỤI','SƯỜN SÁNG','THÁP KHOÉT','BÃI THẠCH CAO'] },
  CAVERN:{ at:'ĐẠI ĐỘNG VÔ DANH · VÙNG NÚI ĐÁ VÔI', forts:['HANG GIẾNG TRỜI','HANG ĐUỐC','HANG RỒNG NGỦ','VỰC THẠCH NHŨ','HANG SUỐI NGẦM','VÒM DƠI ĐEN','CỬA HANG GIÓ','HANG MẠCH NƯỚC'] },
};
// Z181 one line that sells each battlefield (battle setup hero card)
export const BIOME_BLURB={
  DESERT:'Cồn cát bỏng rát dưới bóng kim tự tháp — tầm nhìn xa tít, gần như không có chỗ nấp.',
  RUINS:'Đế chế đổ nát của cổ đô Tro Tàn — cột đá, tường vỡ, giao tranh ở cự li sát sườn.',
  TUNDRA:'Thảo nguyên băng giá miền Bạch Nguyên — đất trơn, gió buốt, quân địch ẩn trong tuyết.',
  FOUNDRY:'Khu luyện thép Thiết Lô — lò cao, ống khói và khói xỉ che khuất tầm ngắm.',
  CITADEL:'Thành luỹ sa thạch xứ Xích Thạch — tường cao, cổng sắt, tướng địch cố thủ đến cùng.',
  MEADOW:'Đồng cỏ cối xay gió Phong Xa — thoáng đãng, cơ động, đọ súng tầm xa.',
  CITY:'Đô thị cảng Hải Đăng — cao ốc, ngã tư chật hẹp, mỗi góc phố là một ổ phục kích.',
  HILLS:'Dãy đồi trường luỹ Thanh Lĩnh — dốc cao, ai chiếm điểm cao người đó thắng.',
  VILLAGE:'Làng quê sông nước — ruộng lúa, cầu tre, luỹ tre làng che chắn.',
  SAVANNA:'Xavan khô hạn Hoàng Thảo — cỏ vàng, cây bao báp và những đồn đất nung.',
  ARCTIC:'Băng nguyên Bắc Phong — trắng xoá, khe nứt băng, gấu trắng rình rập.',
  STEELMILL:'Nhà máy thép bỏ hoang nửa thế kỷ — lò cao gỉ sét, băng tải sập, đường ray mọc cỏ dại.',
  VOLCANO:'Lòng chảo núi lửa Xích Nham — đá bazan đen, dòng dung nham đỏ rực, tro bụi phủ trời. Đừng bước vào lửa.',
  QUARRY:'Mỏ đá trắng Bạch Sơn khai thác từ thời cổ đại — vách bậc thang khổng lồ, khối đá cắt vuông, bụi đá mù mịt.',
  CAVERN:'Lòng hang khổng lồ dưới núi đá vôi — giếng trời rọi nắng xuống rừng nguyên sinh, đuốc cháy dọc vách, địa đạo địch chằng chịt. Bám ánh đuốc, coi chừng trần sập.',
};
export function biomeBlurb(name){ return BIOME_BLURB[name]||''; }
export function biomePlace(name){ return BIOME_PLACE[name] ? BIOME_PLACE[name].at : ''; }
