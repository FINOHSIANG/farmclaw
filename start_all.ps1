Write-Host "启动 FARMCLAW Gateway..."
$gwJob = Start-Job { python e:\workspace\farmclaw\gateway\server.py }
Start-Sleep -Seconds 2

Write-Host "启动边端 Node 节点..."
$iotJob = Start-Job { python e:\workspace\farmclaw\nodes\iot_node.py }
$weatherJob = Start-Job { python e:\workspace\farmclaw\nodes\weather_node.py }

Write-Host "启动认知大脑 Pi Agent..."
$agentJob = Start-Job { python e:\workspace\farmclaw\core\pi_agent.py }

Write-Host "Farmclaw 核心服务已全部后台启动！"
Write-Host "前端大屏可在浏览器访问: http://localhost:5173"
Write-Host "请按任意键停止所有服务并退出..."

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "正在清理进程..."
Stop-Job -Job $iotJob
Stop-Job -Job $weatherJob
Stop-Job -Job $agentJob
Stop-Job -Job $gwJob

Remove-Job -Job $iotJob
Remove-Job -Job $weatherJob
Remove-Job -Job $agentJob
Remove-Job -Job $gwJob

Write-Host "清理完毕！"
