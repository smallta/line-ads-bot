from PIL import Image, ImageDraw, ImageFont
import os

W = 2500
H = 1686
img = Image.new('RGB', (W, H), color='#090D16')
draw = ImageDraw.Draw(img)

# Fonts
font_title = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 60)
font_sub = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 36)
font_badge = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 30)
font_btn = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 32)

tiles = [
    {
        'col': 0, 'row': 0,
        'tag': 'WoW 環比指引', 'tag_bg': '#312E81', 'tag_color': '#A5B4FC',
        'icon': '📊', 'title': '每週成效週報',
        'sub': '近7天環比 ‧ 資本配置',
        'btn': '一鍵調閱', 'btn_color': '#4F46E5', 'btn_bg': '#1E1B4B'
    },
    {
        'col': 1, 'row': 0,
        'tag': '即時大盤', 'tag_bg': '#064E3B', 'tag_color': '#6EE7B7',
        'icon': '📈', 'title': '大盤成效總覽',
        'sub': '花費 ‧ ROAS ‧ 轉換',
        'btn': '查大盤', 'btn_color': '#10B981', 'btn_bg': '#064E3B'
    },
    {
        'col': 2, 'row': 0,
        'tag': '素材健康度', 'tag_bg': '#78350F', 'tag_color': '#FCD34D',
        'icon': '⚡', 'title': '素材疲勞檢驗',
        'sub': '高頻過飽 ‧ 衰退預警',
        'btn': '查疲勞', 'btn_color': '#F59E0B', 'btn_bg': '#451A03'
    },
    {
        'col': 0, 'row': 1,
        'tag': '深度診斷', 'tag_bg': '#581C87', 'tag_color': '#E9D5FF',
        'icon': '🎯', 'title': '素材四象限',
        'sub': '吸血鬼 vs 金牛素材',
        'btn': '素材矩陣', 'btn_color': '#A855F7', 'btn_bg': '#3B0764'
    },
    {
        'col': 1, 'row': 1,
        'tag': '全域雷達', 'tag_bg': '#7F1D1D', 'tag_color': '#FCA5A5',
        'icon': '🛡️', 'title': '16帳號紅綠燈',
        'sub': '違規 ‧ 拒登 ‧ 休眠檢查',
        'btn': '一鍵巡邏', 'btn_color': '#EF4444', 'btn_bg': '#450A0A'
    },
    {
        'col': 2, 'row': 1,
        'tag': '多品牌專案', 'tag_bg': '#0C4A6E', 'tag_color': '#7DD3FC',
        'icon': '🏢', 'title': '切換廣告帳號',
        'sub': '16 授權專案極速切換',
        'btn': '換帳號', 'btn_color': '#0EA5E9', 'btn_bg': '#082F49'
    }
]

cols_w = [833, 834, 833]
cols_x = [0, 833, 1667]
rows_h = 843
rows_y = [0, 843]

pad = 18

for t in tiles:
    c = t['col']
    r = t['row']
    x0 = cols_x[c] + pad
    y0 = rows_y[r] + pad
    w = cols_w[c] - 2 * pad
    h = rows_h - 2 * pad
    x1 = x0 + w
    y1 = y0 + h

    # Card background
    draw.rounded_rectangle([x0, y0, x1, y1], radius=32, fill='#111827', outline='#1F2937', width=3)
    
    # Inner subtle header glow
    draw.rounded_rectangle([x0+4, y0+4, x1-4, y0+12], radius=6, fill='#1F2937')

    # Top Tag Badge
    tag_text = t['tag']
    tag_bbox = draw.textbbox((0, 0), tag_text, font=font_badge)
    tag_w = tag_bbox[2] - tag_bbox[0] + 36
    tag_h = tag_bbox[3] - tag_bbox[1] + 20
    tag_x = x0 + (w - tag_w) // 2
    tag_y = y0 + 65
    draw.rounded_rectangle([tag_x, tag_y, tag_x + tag_w, tag_y + tag_h], radius=16, fill=t['tag_bg'])
    draw.text((tag_x + 18, tag_y + 10), tag_text, font=font_badge, fill=t['tag_color'])

    # Title with icon
    full_title = f"{t['icon']} {t['title']}"
    tb = draw.textbbox((0, 0), full_title, font=font_title)
    tw = tb[2] - tb[0]
    draw.text((x0 + (w - tw) // 2, y0 + 260), full_title, font=font_title, fill='#FFFFFF')

    # Subtitle
    sb = draw.textbbox((0, 0), t['sub'], font=font_sub)
    sw = sb[2] - sb[0]
    draw.text((x0 + (w - sw) // 2, y0 + 380), t['sub'], font=font_sub, fill='#94A3B8')

    # Action Button Pill
    btn_text = f"{t['btn']}  ›"
    bb = draw.textbbox((0, 0), btn_text, font=font_btn)
    bw = bb[2] - bb[0] + 60
    bh = bb[3] - bb[1] + 32
    bx = x0 + (w - bw) // 2
    by = y0 + 540
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=24, fill=t['btn_bg'], outline=t['btn_color'], width=3)
    draw.text((bx + 30, by + 16), btn_text, font=font_btn, fill=t['btn_color'])

img.save('rich_menu.png', format='PNG', optimize=True)
print('Generated rich_menu.png successfully!')
