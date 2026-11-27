// data/text-vi.js — Vietnamese player-facing labels: time of day, difficulty, stage tags, biome & shop-category names

export const TOD_LABEL = { day:'BUỔI SÁNG', noon:'GIỮA TRƯA', sunset:'HOÀNG HÔN', night:'BAN ĐÊM' }; // coins / score payout
// player-chosen DIFFICULTY (RECRUIT/SOLDIER/VETERAN) — scales enemy HP/damage + reward, on top of loop & contract
export const DIFF_META = { recruit:{label:'TÂN BINH',tag:'DỄ'}, soldier:{label:'CHIẾN SĨ',tag:'THƯỜNG'}, veteran:{label:'LÃO LUYỆN',tag:'KHÓ'} };
export const STAGE_TAGS=['CHUẨN BỊ ĐÓN ĐÁNH','VÒNG VÂY SIẾT CHẶT','KHÔNG LÙI BƯỚC','LAO VÀO BÃO LỬA','TRẬN CUỐI CÙNG'];
export const BIOME_VI={ DESERT:'SA MẠC', RUINS:'PHẾ TÍCH', TUNDRA:'BĂNG GIÁ', FOUNDRY:'LÒ ĐÚC', CITADEL:'THÀNH LUỸ', MEADOW:'THẢO NGUYÊN', CITY:'THÀNH PHỐ', HILLS:'ĐỒI NÚI', VILLAGE:'LÀNG QUÊ SÔNG SUỐI', SAVANNA:'XAVAN ĐẤT ĐỎ', ARCTIC:'BẮC CỰC' , STEELMILL:'NHÀ MÁY THÉP BỎ HOANG', VOLCANO:'CHẢO NÚI LỬA', QUARRY:'MỎ ĐÁ THẠCH CAO', CAVERN:'HANG NGẦM' };
// NAMES 1 (was Z170: real landmarks) every battlefield is an INVENTED place — a name in its land's flavour, never a real city, country or monument
//   (style per biome: DOCS "NAMES 1"; config NAMES.banned is the list test.js keeps out of every player-visible text)
export const BIOME_PLACE={
  DESERT:{ at:'KHEMARET · XỨ CÁT ĐỎ', forts:['NEBARET','SAKHUN','TAHMESET','ANKHERU','MERUTA','SEBRAKH','IMHARA','KETSUN','HEMRA-TEP','THUNG LŨNG MỘ ĐÁ'] },
  SAVANNA:{ at:'DJOUROKA · MIỀN ĐẤT ĐỎ', forts:['KOUMBADI','SÉRANKO','NIABOU','TAMBEKO','KAYOUBA','MOLABÉ','SOUNKARA','DIOLAMBA'] },
  TUNDRA:{ at:'ZARYEVSK · XỨ TUYẾT TRẮNG', forts:['STRELOVO','BURANOGRAD','KHOLMETS','LEDYANOVO','SNEZHAR','TUMANSK','STUZHEVO','ZIMOGRAD'] },
  FOUNDRY:{ at:'EISENHALL · VÙNG LÒ THAN', forts:['KOHLENBERG','STAHLFELD','RUSSHEIM','GLUTWERK','SCHLACKENAU','FUNKENTAL','ASCHENROD','KOKSDORF'] },
  CITADEL:{ at:'VARUNGARH · MIỀN SA THẠCH', forts:['DHAVALGARH','KUSHMER','BHAIRAGARH','ANJALMER','VIRASAR','TEJONGARH','KANAKPUR','RUDRAMER'] },
  MEADOW:{ at:'ZEVENWIEK · VÙNG ĐẤT TRŨNG', forts:['GRAANSTEE','VLIETHORST','BLAUWDAM','MOLENVELD','KLAVERWIJK','WIEKENBURG','TULPSTEDE','DIJKHOEVE'] },
  CITY:{ at:'ĐÔ THỊ HẢI ĐĂNG · VÙNG DUYÊN HẢI', forts:['CHỢ TRUNG TÂM','KHU CẢNG CŨ','BÁN ĐẢO MỚI','BẾN PHÀ','KHU PHỐ CỔ','ĐẠI LỘ KÍNH','KHU CÔNG VIÊN','KHU BIỆT THỰ VEN SÔNG'] },
  HILLS:{ at:'THANH LĨNH · MIỀN ĐỒI ĐÁ', forts:['VÂN TIÊU QUAN','HẮC PHONG LĨNH','THIẾT BÍCH QUAN','LONG BỐI LĨNH','BẠCH THẠCH ĐÀI','PHONG HOẢ ĐÀI','NGỌC TRỤ QUAN','THANH VÂN LĨNH'] },
  VILLAGE:{ at:'XÓM BÃI BỒI · VÙNG QUÊ SÔNG NƯỚC', forts:['ĐÌNH LÀNG CŨ','BẾN ĐÒ','GÒ ĐẤT ĐỎ','XÓM LÒ GỐM','CỔNG LÀNG','ĐỒI CHÈ','BÃI NGÔ','RUỘNG BẬC THANG'] },
  RUINS:{ at:'AURELIA VETUS · MIỀN PHẾ ĐÔ', forts:['ARX CINERIS','TURRIS SILVANA','VALLUM LUPI','FORUM SILENTII','CASTELLUM UMBRAE','VIA LAPIDEA','THERMAE VETERES','AQUA FRACTA'] },
  ARCTIC:{ at:'BĂNG NGUYÊN BOREAS · VÙNG CỰC BẮC', forts:['TRẠM CỰC QUANG','VỊNH BĂNG XANH','MŨI GIÓ BẤC','ĐỈNH SƯƠNG MUỐI','CẢNG HẢI CẨU','GÒ GẤU TRẮNG','HẺM BĂNG','TRẠM BÃO TUYẾT'] },
  STEELMILL:{ at:'IRONHOLLOW · THUNG LŨNG RỈ SÉT', forts:['CINDERTON','SLAGPORT','FORGE HILL','RUSTWATER','COKE RIDGE','BLASTFORD','KILNSIDE','SMELTBURY'] },
  VOLCANO:{ at:'HOẢ SƠN XÍCH NHAM · ĐẢO ĐÁ ĐEN', forts:['MIỆNG LỬA','SƯỜN BAZAN','HỒ DUNG NHAM','ĐÈO TRO BỤI','GHỀNH ĐÁ ĐEN','MŨI LƯU HUỲNH','HANG KHÓI','BÃI XỈ ĐỎ'] },
  QUARRY:{ at:'MARMORANO · DÃY NÚI ĐÁ TRẮNG', forts:['CAVA BIANCA','ROCCA MARMIA','VALDISCALPO','PONTE SCHEGGIA','MONTE POLVERE','SERRA LUCENTE','TORRE CAVATA','CAMPO GESSO'] },
  CAVERN:{ at:'ĐẠI ĐỘNG VÔ DANH · VÙNG NÚI ĐÁ VÔI', forts:['HANG GIẾNG TRỜI','HANG ĐUỐC','HANG RỒNG NGỦ','VỰC THẠCH NHŨ','HANG SUỐI NGẦM','VÒM DƠI ĐEN','CỬA HANG GIÓ','HANG MẠCH NƯỚC'] },
};
// Z181 one line that sells each battlefield (battle setup hero card)
export const BIOME_BLURB={
  DESERT:'Cồn cát bỏng rát dưới bóng kim tự tháp — tầm nhìn xa tít, gần như không có chỗ nấp.',
  RUINS:'Đế chế đổ nát của thành cổ Aurelia — cột đá, tường vỡ, giao tranh ở cự li sát sườn.',
  TUNDRA:'Thảo nguyên băng giá ngoại ô Zaryevsk — đất trơn, gió buốt, quân địch ẩn trong tuyết.',
  FOUNDRY:'Khu luyện thép Eisenhall — lò cao, ống khói và khói xỉ che khuất tầm ngắm.',
  CITADEL:'Thành luỹ sa thạch xứ Varungarh — tường cao, cổng sắt, tướng địch cố thủ đến cùng.',
  MEADOW:'Đồng cỏ cối xay gió Zevenwiek — thoáng đãng, cơ động, đọ súng tầm xa.',
  CITY:'Đô thị cảng Hải Đăng — cao ốc, ngã tư chật hẹp, mỗi góc phố là một ổ phục kích.',
  HILLS:'Dãy đồi trường luỹ Thanh Lĩnh — dốc cao, ai chiếm điểm cao người đó thắng.',
  VILLAGE:'Làng quê sông nước — ruộng lúa, cầu tre, luỹ tre làng che chắn.',
  SAVANNA:'Xavan khô hạn Djouroka — cỏ vàng, cây bao báp và những đồn đất nung.',
  ARCTIC:'Băng nguyên Boreas — trắng xoá, khe nứt băng, gấu trắng rình rập.',
  STEELMILL:'Nhà máy thép bỏ hoang nửa thế kỷ — lò cao gỉ sét, băng tải sập, đường ray mọc cỏ dại.',
  VOLCANO:'Lòng chảo núi lửa Xích Nham — đá bazan đen, dòng dung nham đỏ rực, tro bụi phủ trời. Đừng bước vào lửa.',
  QUARRY:'Mỏ đá trắng Marmorano khai thác từ thời cổ đại — vách bậc thang khổng lồ, khối đá cắt vuông, bụi đá mù mịt.',
  CAVERN:'Lòng hang khổng lồ dưới núi đá vôi — giếng trời rọi nắng xuống rừng nguyên sinh, đuốc cháy dọc vách, địa đạo địch chằng chịt. Bám ánh đuốc, coi chừng trần sập.',
};
export function biomeBlurb(name){ return BIOME_BLURB[name]||''; }
export function biomePlace(name){ return BIOME_PLACE[name] ? BIOME_PLACE[name].at : ''; }
