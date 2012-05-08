require "rubygems"
require "bundler/setup"
require "em-websocket"
require "sinatra/base"
require "thin"
require "json"

$db = {}
$ws = {}
$conns = {}

EM.run do
  class App < Sinatra::Base
    get "/" do
      File.read(File.dirname(__FILE__) + "/public/index.html")
    end
    
    get "/api/:key" do
      puts "get: #{params.inspect}"
      $db[params[:app]] ||= {}
      value = $db[params[:app]][params[:key]] ||= {}
      puts $db.inspect
      JSON.generate(value)
    end
    
    post "/api/:key" do
      body = request.env["rack.input"].read
      puts "post: #{body}"
      begin
        app = params[:app]
        key = "/api/#{params[:key]}?app=#{params[:app]}"
        
        $db[app] ||= {}
        $db[app][key] = JSON.parse(body)
      
        if wss = ($ws[app] && $ws[app][key])
          message = JSON.generate(key => $db[app][key])
          wss.each do |ws|
            ws.send(message)
          end
        end
      
        body
      rescue JSON::ParserError => e
        JSON.generate({"status" => "error", "message" => e.message})
      end
    end
  end

  EM::WebSocket.start(:host => "0.0.0.0", :port => 3001) do |ws|
    ws.onopen do
      puts "Opening #{ws}"
    end
    
    ws.onmessage do |message|
      data = JSON.parse(message)
      action = data["action"]
      app = data["app"]
      key = data["key"]
      
      case action
      when "listen"
        puts "listen: #{data.inspect}"
        $ws[app] ||= {}
        $ws[app][key] ||=[]
        $ws[app][key] << ws
        $conns[ws] ||= {}
        $conns[ws][[app, key]] = true
      when "cancel"
        $ws[app] ||= {}
        $ws[app][key].delete(ws)
        $conns[ws] ||= {}
        $conns[ws].delete([app, key])
      end
    end
    
    ws.onclose do 
      puts "Closing #{ws}"
      $conns[ws] ||= {}
      $conns[ws].each do |app, key|
        $ws.delete(app)
      end
      $conns.delete(ws)
    end
  end

  Thin::Server.start App, "0.0.0.0", 3000
end