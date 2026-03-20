$gwJob = Start-Job { python e:\workspace\farmclaw\gateway\server.py }
Start-Sleep -Seconds 2

$iotJob = Start-Job { python e:\workspace\farmclaw\nodes\iot_node.py }
$weatherJob = Start-Job { python e:\workspace\farmclaw\nodes\weather_node.py }
$agentJob = Start-Job { python e:\workspace\farmclaw\core\pi_agent.py }

Start-Sleep -Seconds 3

Write-Host "运行测试客户端..."
python e:\workspace\farmclaw\tests\test_flow.py

Start-Sleep -Seconds 1

Write-Host "----- Gateway Logs -----"
Receive-Job -Job $gwJob | ForEach-Object { $_ }
Write-Host "----- Agent Logs -----"
Receive-Job -Job $agentJob | ForEach-Object { $_ }
Write-Host "----- IoT Logs -----"
Receive-Job -Job $iotJob | ForEach-Object { $_ }
Write-Host "----- Weather Logs -----"
Receive-Job -Job $weatherJob | ForEach-Object { $_ }

Write-Host "清理进程..."
Stop-Job -Job $iotJob
Stop-Job -Job $weatherJob
Stop-Job -Job $agentJob
Stop-Job -Job $gwJob

Remove-Job -Job $iotJob
Remove-Job -Job $weatherJob
Remove-Job -Job $agentJob
Remove-Job -Job $gwJob
