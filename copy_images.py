import os, glob, shutil
base_dir = '/home/igor/.gemini/antigravity/brain/885732f0-95e4-4d31-aa31-fa17450dc284'
target_dir = 'frontend/assets'
os.makedirs(target_dir, exist_ok=True)
files = glob.glob(os.path.join(base_dir, '*.png'))
for f in files:
    name = os.path.basename(f)
    if 'monk_blue' in name: shutil.copy(f, os.path.join(target_dir, 'monk_blue.png'))
    elif 'sensei_blue' in name: shutil.copy(f, os.path.join(target_dir, 'sensei_blue.png'))
    elif 'monk_red' in name: shutil.copy(f, os.path.join(target_dir, 'monk_red.png'))
    elif 'sensei_red' in name: shutil.copy(f, os.path.join(target_dir, 'sensei_red.png'))
print("Copied images successfully")
