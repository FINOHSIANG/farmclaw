import sys
import os

# Add parent directory to path to allow importing from core and plugins
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.agent import FarmclawAgent

def main():
    print("================================================")
    print("           欢迎使用 FARMCLAW 控制终端")
    print("================================================")
    print("输入 'exit' 或 'quit' 退出。")
    print("")

    agent = FarmclawAgent()
    print("[系统] FARMCLAW Agent 已初始化，已加载以下插件：")
    for name, plugin in agent.plugins.items():
        print(f"  - {name}")
    print()

    while True:
        try:
            user_input = input("农民👨‍🌾: ")
            if user_input.lower() in ['exit', 'quit']:
                break
            
            if not user_input.strip():
                continue
                
            response = agent.process_input(user_input)
            print(f"\nFARMCLAW🤖: {response}\n")
            print("-" * 50)
            
        except (KeyboardInterrupt, EOFError):
            print("\n正在退出...")
            break
        except Exception as e:
            print(f"\n[错误] {e}")

if __name__ == "__main__":
    main()
