from PIL import Image, ImageDraw, ImageFont

W = 2500
H = 1686
img = Image.new('RGB', (W, H), color='#070A13')
draw = ImageDraw.Draw(img)

font_path = '/System/Library/Fonts/STHeiti Medium.ttc'

# Maximum readability font sizes for mobile
font_title_3 = ImageFont.truetype(font_path, 136)  # For 3-character titles like 看週報, 看成效, 查疲勞
font_title_4 = ImageFont.truetype(font_path, 122)  # For 4-character titles like 素材象限, 全域巡邏, 切換帳號
font_sub = ImageFont.truetype(font_path, 54)
font_badge = ImageFont.truetype(font_path, 46)
font_btn = ImageFont.truetype(font_path, 52)

tiles = [
    {
        'col': 0, 'row': 0,
        'tag': 'WoW 環比 ‧ 資本配置', 'tag_bg': '#312E81', 'tag_color': '#C7D2FE',
        'title': '看週報',
        'sub': '近 7 天趨勢與加碼指引',
        'btn': '一鍵調閱 ›', 'btn_color': '#A5B4FC', 'btn_bg': '#1E1B4B', 'btn_border': '#4F46E5'
    },
    {
        'col': 1, 'row': 0,
        'tag': '今日即時 ‧ 7 天大盤', 'tag_bg': '#064E3B', 'tag_color': '#A7F3D0',
        'title': '看成效',
        'sub': '即時花費 ‧ 轉換 ‧ ROAS',
        'btn': '查大盤 ›', 'btn_color': '#6EE7B7', 'btn_bg': '#064E3B', 'btn_border': '#10B981'
    },
    {
        'col': 2, 'row': 0,
        'tag': '素材健康 ‧ 異常預警', 'tag_bg': '#78350F', 'tag_color': '#FDE68A',
        'title': '查疲勞',
        'sub': '高頻飽和 ‧ 衰退警報',
        'btn': '立即檢驗 ›', 'btn_color': '#FCD34D', 'btn_bg': '#451A03', 'btn_border': '#D97706'
    },
    {
        'col': 0, 'row': 1,
        'tag': '深度診斷 ‧ 人性洞察', 'tag_bg': '#581C87', 'tag_color': '#F3E8FF',
        'title': '素材象限',
        'sub': '吸血鬼 vs 金牛素材',
        'btn': '四象限診斷 ›', 'btn_color': '#D8B4FE', 'btn_bg': '#3B0764', 'btn_border': '#9333EA'
    },
    {
        'col': 1, 'row': 1,
        'tag': '全域雷達 ‧ 違規排查', 'tag_bg': '#7F1D1D', 'tag_color': '#FECACA',
        'title': '全域巡邏',
        'sub': '16 帳號紅綠燈體檢',
        'btn': '一鍵體檢 ›', 'btn_color': '#FCA5A5', 'btn_bg': '#450A0A', 'btn_border': '#DC2626'
    },
    {
        'col': 2, 'row': 1,
        'tag': '多品牌專案 ‧ 即時切換', 'tag_bg': '#0C4A6E', 'tag_color': '#BAE6FD',
        'title': '切換帳號',
        'sub': '16 個專案品牌直達',
        'btn': '選擇帳號 ›', 'btn_color': '#7DD3FC', 'btn_bg': '#082F49', 'btn_border': '#0284C7'
    }
]

cols_w = [833, 834, 833]
cols_x = [0, 833, 1667]
rows_h = 843
rows_y = [0, 843]

pad = 16

for t in tiles:
    c = t['col']
    r = t['row']
    x0 = cols_x[c] + pad
    y0 = rows_y[r] + pad
    w = cols_w[c] - 2 * pad
    h = rows_h - 2 * pad
    x1 = x0 + w
    y1 = y0 + h

    # Card background (Dark slate glassmorphism with high contrast border)
    draw.rounded_rectangle([x0, y0, x1, y1], radius=32, fill='#111827', outline='#1F2937', width=4)

    # 1. Top Badge Pill
    tag_text = t['tag']
    tag_bbox = draw.textbbox((0, 0), tag_text, font=font_badge)
    tag_tw = tag_bbox[2] - tag_bbox[0]
    tag_th = tag_bbox[3] - tag_bbox[1]
    tag_w = tag_tw + 56
    tag_h = tag_th + 30
    tag_x = x0 + (w - tag_w) // 2
    tag_y = y0 + 65
    draw.rounded_rectangle([tag_x, tag_y, tag_x + tag_w, tag_y + tag_h], radius=22, fill=t['tag_bg'])
    draw.text((tag_x + 28, tag_y + 13), tag_text, font=font_badge, fill=t['tag_color'])

    # 2. Main Title (MASSIVE, BOLD, 100% CRISP)
    title_text = t['title']
    cur_font = font_title_3 if len(title_text) <= 3 else font_title_4
    tb = draw.textbbox((0, 0), title_text, font=cur_font)
    tw = tb[2] - tb[0]
    draw.text((x0 + (w - tw) // 2, y0 + 225), title_text, font=cur_font, fill='#FFFFFF')

    # 3. Subtitle (54px for comfortable reading)
    sub_text = t['sub']
    sb = draw.textbbox((0, 0), sub_text, font=font_sub)
    sw = sb[2] - sb[0]
    draw.text((x0 + (w - sw) // 2, y0 + 400), sub_text, font=font_sub, fill='#94A3B8')

    # 4. Action Button Pill (Prominent tap target)
    btn_text = t['btn']
    bb = draw.textbbox((0, 0), btn_text, font=font_btn)
    bw = bb[2] - bb[0] + 90
    bh = bb[3] - bb[1] + 46
    bx = x0 + (w - bw) // 2
    by = y0 + 535
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=32, fill=t['btn_bg'], outline=t['btn_border'], width=4)
    draw.text((bx + 45, by + 20), btn_text, font=font_btn, fill=t['btn_color'])

img.save('rich_menu.png', format='PNG', optimize=True)
print('Generated ultra-large rich_menu.png successfully!')
